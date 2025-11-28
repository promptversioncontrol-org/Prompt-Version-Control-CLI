import type { SessionReport, FileEdit, RiskFinding } from '../types';

interface DiffLine {
  type: 'unchanged' | 'removed' | 'added';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

// ============================================================================
// DIFF ALGORITHM (Myers)
// ============================================================================

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const n = oldLines.length;
  const m = newLines.length;
  const max = n + m;
  const v: Map<number, number> = new Map();
  const trace: Map<number, number>[] = [];

  v.set(1, 0);

  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v.get(k - 1) || 0) < (v.get(k + 1) || 0))) {
        x = v.get(k + 1) || 0;
      } else {
        x = (v.get(k - 1) || 0) + 1;
      }

      let y = x - k;

      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }

      v.set(k, x);

      if (x >= n && y >= m) {
        return backtrack(trace, oldLines, newLines, d);
      }
    }
  }

  return simpleDiff(oldLines, newLines);
}

function backtrack(
  trace: Map<number, number>[],
  oldLines: string[],
  newLines: string[],
  d: number,
): DiffLine[] {
  const result: DiffLine[] = [];
  let x = oldLines.length;
  let y = newLines.length;

  for (let depth = d; depth > 0; depth--) {
    const v = trace[depth];
    const k = x - y;
    let prevK: number;

    if (
      k === -depth ||
      (k !== depth && (v.get(k - 1) || 0) < (v.get(k + 1) || 0))
    ) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v.get(prevK) || 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      result.unshift({
        type: 'unchanged',
        oldLineNumber: x + 1,
        newLineNumber: y + 1,
        content: oldLines[x],
      });
    }

    if (x > prevX) {
      x--;
      result.unshift({
        type: 'removed',
        oldLineNumber: x + 1,
        content: oldLines[x],
      });
    } else if (y > prevY) {
      y--;
      result.unshift({
        type: 'added',
        newLineNumber: y + 1,
        content: newLines[y],
      });
    }
  }

  while (x > 0 && y > 0) {
    x--;
    y--;
    result.unshift({
      type: 'unchanged',
      oldLineNumber: x + 1,
      newLineNumber: y + 1,
      content: oldLines[x],
    });
  }

  return result;
}

function simpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < oldLines.length && i < newLines.length) {
      if (oldLines[i] === newLines[i]) {
        result.push({
          type: 'unchanged',
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
          content: oldLines[i],
        });
      } else {
        result.push({
          type: 'removed',
          oldLineNumber: i + 1,
          content: oldLines[i],
        });
        result.push({
          type: 'added',
          newLineNumber: i + 1,
          content: newLines[i],
        });
      }
    } else if (i < oldLines.length) {
      result.push({
        type: 'removed',
        oldLineNumber: i + 1,
        content: oldLines[i],
      });
    } else {
      result.push({
        type: 'added',
        newLineNumber: i + 1,
        content: newLines[i],
      });
    }
  }

  return result;
}

function createHunks(
  diffLines: DiffLine[],
  contextLines: number = 3,
): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let unchangedBuffer: DiffLine[] = [];

  for (const line of diffLines) {
    if (line.type === 'unchanged') {
      unchangedBuffer.push(line);
      if (currentHunk && unchangedBuffer.length > contextLines * 2) {
        currentHunk.lines.push(...unchangedBuffer.slice(0, contextLines));
        hunks.push(currentHunk);
        currentHunk = null;
        unchangedBuffer = unchangedBuffer.slice(-contextLines);
      }
    } else {
      if (!currentHunk) {
        const leadingContext = unchangedBuffer.slice(-contextLines);
        const firstLine = leadingContext[0] || line;
        currentHunk = {
          oldStart: firstLine.oldLineNumber || 0,
          oldCount: 0,
          newStart: firstLine.newLineNumber || 0,
          newCount: 0,
          lines: [...leadingContext],
        };
        unchangedBuffer = [];
      } else {
        currentHunk.lines.push(...unchangedBuffer);
        unchangedBuffer = [];
      }
      currentHunk.lines.push(line);
    }
  }

  if (currentHunk) {
    currentHunk.lines.push(...unchangedBuffer.slice(0, contextLines));
    hunks.push(currentHunk);
  }

  hunks.forEach((hunk) => {
    hunk.oldCount = hunk.lines.filter((l) => l.type !== 'added').length;
    hunk.newCount = hunk.lines.filter((l) => l.type !== 'removed').length;
  });

  return hunks;
}

// ============================================================================
// MARKDOWN GENERATION
// ============================================================================

function cleanMessageText(raw: string): string {
  let text = raw;

  // If Codex-style wrapper is present, keep only the actual request
  const marker = '## My request for Codex:';
  const markerIndex = text.indexOf(marker);
  if (markerIndex !== -1) {
    text = text.slice(markerIndex + marker.length).trim();
  }

  // Remove leading "# Context from my IDE setup" block if any remains
  text = text
    .replace(
      /# Context from my IDE setup:[\s\S]*?(?:## My request for Codex:)?/m,
      '',
    )
    .trim();

  return text;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/ /g, '&nbsp;')
    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
}

function createCompactDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diffLines = computeDiff(oldLines, newLines);
  const hunks = createHunks(diffLines, 3);

  if (hunks.length === 0) {
    return '<div style="padding:12px;background:#1e1e1e;color:#d4d4d4;border-radius:6px;font-family:monospace">No changes</div>';
  }

  let html =
    '<div style="background:#1e1e1e;padding:16px;border-radius:8px;overflow-x:auto;font-family:\'Courier New\',monospace;font-size:13px;line-height:1.5">\\n';

  for (let hunkIdx = 0; hunkIdx < hunks.length; hunkIdx++) {
    const hunk = hunks[hunkIdx];

    if (hunkIdx > 0) {
      html += `<div style="color:#666;padding:8px 0;border-top:1px solid #333">@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@</div>\\n`;
    }

    for (const line of hunk.lines) {
      const lineNum = line.oldLineNumber || line.newLineNumber || 0;
      const lineNumSpan =
        `<span style="color:#666;user-select:none;display:inline-block;width:40px;text-align:right;margin-right:12px">` +
        lineNum +
        '</span>';
      const content = escapeHtml(line.content) || '&nbsp;';

      if (line.type === 'removed') {
        html += `<div style="background:#4a1a1a;color:#ff6b6b">${lineNumSpan}<span style="color:#ff4444">-</span> <s>${content}</s></div>\\n`;
      } else if (line.type === 'added') {
        html += `<div style="background:#1a4a1a;color:#69db7c">${lineNumSpan}<span style="color:#44ff44">+</span> ${content}</div>\\n`;
      } else {
        html += `<div style="color:#d4d4d4">${lineNumSpan}<span style="color:#666">&nbsp;</span> ${content}</div>\\n`;
      }
    }
  }

  html += '</div>';
  return html;
}

export function generateMarkdownReport(report: SessionReport): string {
  let md = `# PVC Report - Session ${report.sessionId}\n\n`;
  md += `**Generated at:** ${report.generatedAt}\n`;
  md += `**Working Directory:** \`${report.cwd}\`\n\n`;
  md += `---\n\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `- **User Prompts:** ${report.userPrompts.length}\n`;
  md += `- **Assistant Responses:** ${report.assistantMessages.length}\n`;
  md += `- **File Edits:** ${report.fileEdits.length}\n\n`;
  md += `---\n\n`;

  // --- RISK SUMMARY ---
  if (report.riskSummary && report.riskSummary.totalFindings > 0) {
    const { maxScore, totalFindings, findings } = report.riskSummary;

    // Count by severity
    const counts = { high: 0, medium: 0, low: 0 };
    findings.forEach((f) => {
      if (counts[f.severity] !== undefined) counts[f.severity]++;
    });

    md += `## Risk Summary\n\n`;
    md += `- **Max risk score (0–100):** ${maxScore}\n`;
    md += `- **Total findings:** ${totalFindings}\n\n`;
    md += `| Severity | Count |\n`;
    md += `|---|---|\n`;
    md += `| 🔴 High | ${counts.high} |\n`;
    md += `| 🟠 Medium | ${counts.medium} |\n`;
    md += `| 🟡 Low | ${counts.low} |\n\n`;
    md += `### Top Findings\n\n`;

    // Sort by severity (High > Medium > Low) then timestamp
    const severityOrder = { high: 3, medium: 2, low: 1 };
    const sortedFindings = [...findings].sort((a, b) => {
      const diff = severityOrder[b.severity] - severityOrder[a.severity];
      if (diff !== 0) return diff;
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    // Show top 10
    sortedFindings.slice(0, 10).forEach((f, i) => {
      const icon =
        f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟠' : '🟡';
      const source = f.source === 'file' ? `file \`${f.filePath}\`` : f.source;
      let snippet = f.snippet
        ? ` – "${f.snippet.replace(/\n/g, ' ').substring(0, 50)}..."`
        : '';
      if (f.blocked) snippet += ' (BLOCKED)';

      md += `${i + 1}. ${icon} **[${f.severity}]** ${f.ruleId} in ${source}${snippet}\n`;
    });

    if (sortedFindings.length > 10) {
      md += `\n`;
      md += `... and ${sortedFindings.length - 10} more.\n`;
    }

    md += `\n`;
    md += `---\n\n`;
  } else if (
    typeof report.riskScore === 'number' &&
    report.findings &&
    report.findings.length > 0
  ) {
    // Legacy fallback
    const total = report.findings.length;
    const high = report.findings.filter((f) => f.severity === 'high').length;
    const medium = report.findings.filter(
      (f) => f.severity === 'medium',
    ).length;
    const low = report.findings.filter((f) => f.severity === 'low').length;

    md += `## Risk Summary (Legacy)\n\n`;
    md += `- **Risk Score:** ${report.riskScore} / 100\n`;
    md += `- **Findings:** ${total} (high: ${high}, medium: ${medium}, low: ${low})\n\n`;

    md += `### Findings Details\n\n`;
    for (const f of report.findings) {
      const blockedTag = f.blocked ? ' (BLOCKED PROMPT)' : '';
      md += `- **[${f.severity.toUpperCase()}] ${f.ruleId}${blockedTag}** – ${f.message}\n`;
      md += `  - Source: \`${f.sourceType}\` (${f.sourceId}) at ${f.timestamp}\n`;
      if (f.snippet) {
        const snippet = f.snippet.replace(/\n/g, ' ');
        md += `  - Snippet: \`${snippet.slice(0, 120)}\`\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  // Timeline
  md += `## Session Timeline\n\n`;

  const userPrompts = report.userPrompts.map((p) => ({
    timestamp: p.timestamp,
    type: 'user' as const,
    data: p,
  }));

  const assistantMessages = report.assistantMessages.map((a) => ({
    timestamp: a.timestamp,
    type: 'assistant' as const,
    data: a,
  }));

  const fileEditsTimeline = report.fileEdits.map((e) => ({
    timestamp: e.timestamp,
    type: 'file_edit' as const,
    data: e,
  }));

  const allEvents = [
    ...userPrompts,
    ...assistantMessages,
    ...fileEditsTimeline,
  ].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Group consecutive file edits for same file
  const groupedTimeline: Array<{
    timestamp: string;
    type: 'user' | 'assistant' | 'file_edits';
    data: any;
  }> = [];

  let i = 0;
  while (i < allEvents.length) {
    const current = allEvents[i];

    if (current.type === 'file_edit') {
      const editData = current.data as FileEdit;
      const filePath = editData.path;
      const groupedEdits: FileEdit[] = [editData];
      let j = i + 1;

      while (
        j < allEvents.length &&
        allEvents[j].type === 'file_edit' &&
        (allEvents[j].data as FileEdit).path === filePath
      ) {
        groupedEdits.push(allEvents[j].data as FileEdit);
        j++;
      }

      const firstEdit = groupedEdits[0];
      const lastEdit = groupedEdits[groupedEdits.length - 1];

      groupedTimeline.push({
        timestamp: firstEdit.timestamp,
        type: 'file_edits',
        data: {
          path: filePath,
          oldContent: firstEdit.oldContent,
          newContent: lastEdit.newContent,
          isNewFile: (firstEdit as FileEdit & { isNewFile?: boolean })
            .isNewFile,
          editCount: groupedEdits.length,
          timestamps: groupedEdits.map((e) => e.timestamp),
        },
      });

      i = j;
    } else {
      groupedTimeline.push(current as any);
      i++;
    }
  }

  // Generate timeline entries
  for (const item of groupedTimeline) {
    if (item.type === 'user') {
      md += `### User - \`${item.timestamp}\`\n\n`;
      md += cleanMessageText(item.data.text);
      md += '\n\n';
      md += `---\n\n`;
    } else if (item.type === 'assistant') {
      md += `### Assistant - \`${item.timestamp}\`\n\n`;
      md += cleanMessageText(item.data.text);
      md += '\n\n';
      md += `---\n\n`;
    } else if (item.type === 'file_edits') {
      const edit = item.data as {
        path: string;
        oldContent: string;
        newContent: string;
        isNewFile?: boolean;
        editCount: number;
        timestamps: string[];
      };

      if (edit.isNewFile) {
        md += `### Created New File: \`${edit.path}\`\n\n`;
        if (edit.editCount > 1) {
          md += `*${edit.editCount} consecutive edits merged*\n\n`;
        }

        const lines = edit.newContent.split('\n');
        md += `<details>\n<summary>View Content (${lines.length} lines)</summary>\n\n`;
        md += '```tsx\n';
        md += edit.newContent;
        md += '\n```\n\n';
        md += `</details>\n\n`;
      } else {
        const oldLines = edit.oldContent.split('\n');
        const newLines = edit.newContent.split('\n');
        const diffLines = computeDiff(oldLines, newLines);
        const addedCount = diffLines.filter((l) => l.type === 'added').length;
        const removedCount = diffLines.filter(
          (l) => l.type === 'removed',
        ).length;

        md += `### Modified File: \`${edit.path}\`\n\n`;
        if (edit.editCount > 1) {
          md += `*${edit.editCount} consecutive edits merged*\n\n`;
        }

        md += `<details>\n<summary>Changes: <span style="color:#44ff44">+${addedCount}</span> <span style="color:#ff4444">-${removedCount}</span></summary>\n\n`;
        md += createCompactDiff(edit.oldContent, edit.newContent);
        md += `\n\n</details>\n\n`;
      }

      md += `---\n\n`;
    }
  }

  return md;
}
