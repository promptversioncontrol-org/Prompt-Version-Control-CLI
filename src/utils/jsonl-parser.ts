import { readFileSync } from 'fs';
import type {
  UserPrompt,
  AssistantMessage,
  Reasoning,
  ShellCommand,
  Patch,
  FileEdit,
} from '../types';

interface ParsedPrompt {
  text: string;
  context?: string;
  activeFile?: string;
  activeSelection?: string;
  openTabs?: string[];
}

function parseAugmentedPrompt(raw: string): ParsedPrompt {
  // Detect Codex IDE context blocks and split into fields
  if (!raw.includes('# Context from my IDE setup')) {
    const clean = raw.trim();
    return { text: clean };
  }

  const sections: Record<string, string[]> = {};
  let current = 'context';

  const pushLine = (section: string, line: string) => {
    if (!sections[section]) sections[section] = [];
    sections[section].push(line);
  };

  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    if (/^#\s+Context from my IDE setup:?/i.test(line)) {
      current = 'context';
      continue;
    }

    const headerMatch = line.match(
      /^##\s+(Active file|Active selection of the file|Open tabs|My request for Codex):\s*(.*)$/i,
    );
    if (headerMatch) {
      const sectionName = headerMatch[1].toLowerCase();
      const inlineValue = headerMatch[2];

      if (sectionName.startsWith('active file')) current = 'activeFile';
      else if (sectionName.startsWith('active selection'))
        current = 'activeSelection';
      else if (sectionName.startsWith('open tabs')) current = 'openTabs';
      else if (sectionName.startsWith('my request')) current = 'request';
      else current = 'context';

      if (inlineValue) {
        pushLine(current, inlineValue);
      }
      continue;
    }

    pushLine(current, line);
  }

  const getSection = (key: string) => (sections[key] || []).join('\n').trim();

  const openTabs = (sections['openTabs'] || [])
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);

  const result: ParsedPrompt = {
    text: getSection('request') || getSection('context') || raw.trim(),
    context: getSection('context') || undefined,
    activeFile: getSection('activeFile') || undefined,
    activeSelection: getSection('activeSelection') || undefined,
    openTabs: openTabs.length ? openTabs : undefined,
  };

  return result;
}

export function parseJSONLFile(filepath: string): any[] {
  const content = readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  const events: any[] = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      console.error(`Failed to parse JSONL line: ${line.slice(0, 50)}...`);
      continue;
    }
  }

  return events;
}

export function extractUserPrompts(events: any[]): UserPrompt[] {
  return events
    .filter((e) => e.type === 'event_msg' && e.payload?.type === 'user_message')
    .map((e) => {
      const parsed = parseAugmentedPrompt(e.payload.message || '');
      return {
        timestamp: e.timestamp,
        text: parsed.text,
        context: parsed.context,
        activeFile: parsed.activeFile,
        activeSelection: parsed.activeSelection,
        openTabs: parsed.openTabs,
      };
    });
}

export function extractAssistantMessages(events: any[]): AssistantMessage[] {
  const messages: AssistantMessage[] = [];

  for (const e of events) {
    // Regular assistant messages
    if (
      e.type === 'response_item' &&
      e.payload?.type === 'message' &&
      e.payload.role === 'assistant'
    ) {
      let text = e.payload.content.map((c: any) => c.text || '').join('');

      // Remove "Active file:" and "Open tabs:" sections
      text = text.replace(/Active file:.*?\n/g, '');
      text = text.replace(/Open tabs:[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
      text = text.trim();

      if (text) {
        messages.push({
          timestamp: e.timestamp,
          text,
        });
      }
    }
  }

  return messages;
}

export function extractReasonings(events: any[]): Reasoning[] {
  return events
    .filter(
      (e) => e.type === 'response_item' && e.payload?.type === 'reasoning',
    )
    .map((e) => ({
      timestamp: e.timestamp,
      summary: e.payload.summary?.map((s: any) => s.text).join('\n') || '',
      encrypted: e.payload.encrypted_content || '',
    }));
}

export function extractShellCommands(events: any[]): ShellCommand[] {
  return events
    .filter(
      (e) =>
        e.type === 'response_item' &&
        e.payload?.type === 'function_call' &&
        e.payload.name === 'shell',
    )
    .map((e) => ({
      timestamp: e.timestamp,
      command: e.payload.arguments,
    }));
}

export function extractPatches(events: any[]): Patch[] {
  return events
    .filter(
      (e) => e.type === 'response_item' && e.payload?.type === 'apply_patch',
    )
    .map((e) => ({
      timestamp: e.timestamp,
      patch: e.payload.patch,
    }));
}

export function extractFileEdits(events: any[]): FileEdit[] {
  const edits: FileEdit[] = [];

  for (const event of events) {
    // write_file (modify existing file)
    if (
      event.type === 'response_item' &&
      event.payload?.type === 'function_call' &&
      event.payload.name === 'write_file'
    ) {
      const args = event.payload.arguments;
      edits.push({
        timestamp: event.timestamp,
        path: args.path || 'unknown',
        oldContent: args.old_content || '',
        newContent: args.new_content || '',
        isNewFile: false,
      });
    }

    // edit_file (modify existing file)
    if (
      event.type === 'response_item' &&
      event.payload?.type === 'function_call' &&
      event.payload.name === 'edit_file'
    ) {
      const args = event.payload.arguments;
      edits.push({
        timestamp: event.timestamp,
        path: args.path || 'unknown',
        oldContent: args.old_str || '',
        newContent: args.new_str || '',
        isNewFile: false,
      });
    }

    // create_file (NEW FILE)
    if (
      event.type === 'response_item' &&
      event.payload?.type === 'function_call' &&
      event.payload.name === 'create_file'
    ) {
      const args = event.payload.arguments;
      edits.push({
        timestamp: event.timestamp,
        path: args.path || 'unknown',
        oldContent: '',
        newContent: args.content || '',
        isNewFile: true,
      });
    }

    // ghost_snapshot
    if (event.type === 'ghost_snapshot' && event.payload?.ghost_commit?.diffs) {
      for (const diff of event.payload.ghost_commit.diffs) {
        edits.push({
          timestamp: event.timestamp,
          path: diff.path || 'unknown',
          oldContent: diff.old_content || '',
          newContent: diff.new_content || '',
          isNewFile: !diff.old_content,
        });
      }
    }

    // apply_patch (handle both Add File and Update File)
    if (
      event.type === 'response_item' &&
      event.payload?.type === 'custom_tool_call' &&
      event.payload.name === 'apply_patch' &&
      event.payload.status === 'completed'
    ) {
      const patchInput = event.payload.input || '';

      // Case 1: *** Add File: (new file created via patch)
      const addMatch = patchInput.match(/\*\*\* Add File: (.+)/);
      if (addMatch) {
        const fileName = addMatch[1].trim();
        const lines = patchInput.split('\n');
        const newLines: string[] = [];
        let collecting = false;

        for (const line of lines) {
          if (line.startsWith('*** Add File:')) {
            // start collecting lines for this file
            collecting = true;
            continue;
          }
          if (collecting) {
            // stop if we hit another file header or end marker
            if (line.startsWith('*** ') && !line.startsWith('*** Add File:')) {
              break;
            }
            if (line.startsWith('+')) {
              newLines.push(line.substring(1));
            }
          }
        }

        edits.push({
          timestamp: event.timestamp,
          path: fileName,
          oldContent: '',
          newContent: newLines.join('\n'),
          isNewFile: true,
        });
        continue;
      }

      // Case 2: *** Update File: (existing file modified via patch)
      const updateMatch = patchInput.match(/\*\*\* Update File: (.+)/);
      if (updateMatch) {
        const fileName = updateMatch[1].trim();
        const lines = patchInput.split('\n');
        const oldLines: string[] = [];
        const newLines: string[] = [];
        let inDiff = false;

        for (const line of lines) {
          if (line.startsWith('@@')) {
            inDiff = true;
            continue;
          }

          if (inDiff) {
            if (line.startsWith('-') && !line.startsWith('---')) {
              oldLines.push(line.substring(1));
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
              newLines.push(line.substring(1));
            }
          }
        }

        if (oldLines.length > 0 || newLines.length > 0) {
          edits.push({
            timestamp: event.timestamp,
            path: fileName,
            oldContent: oldLines.join('\n'),
            newContent: newLines.join('\n'),
            isNewFile: false,
          });
        }
      }
    }
  }

  return edits;
}
