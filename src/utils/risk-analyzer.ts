import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { getPVCDir } from './path-utils';
import type {
  RiskRule,
  RiskFinding,
  RiskSeverity,
  SensitiveScanResult,
  UserPrompt,
  AssistantMessage,
  FileEdit,
  AnalyzeResult,
} from '../types';

// --- CONFIG & UTILS ---

export interface FileSensitivityConfig {
  folderPatterns: RegExp[];
  filePatterns: RegExp[];
}

export interface PromptRiskResult extends SensitiveScanResult {
  promptText: string;
}

function loadLines(filePath: string): string[] {
  if (!existsSync(filePath)) {
    return [];
  }
  const lines = readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  return lines;
}

function globToRegex(pattern: string): RegExp {
  const originalPattern = pattern.trim();

  // Escape special regex characters EXCEPT *
  let regex = originalPattern
    .replace(/\\/g, '\\\\')
    .replace(/\./g, '\\.')
    .replace(/\+/g, '\\+')
    .replace(/\?/g, '.')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\|/g, '\\|')
    .replace(/\^/g, '\\^')
    .replace(/\$/g, '\\$');

  // Replace * with .* (any characters)
  regex = regex.replace(/\*/g, '.*');

  // Add anchors based on original pattern
  if (!originalPattern.startsWith('*')) {
    regex = '^' + regex;
  }

  if (!originalPattern.endsWith('*')) {
    regex = regex + '$';
  }

  return new RegExp(regex, 'i');
}

export function loadFileSensitivityConfig(cwd: string): FileSensitivityConfig {
  const pvcDir = getPVCDir(cwd);
  const sensitiveDir = path.join(pvcDir, 'sensitive');

  const foldersFile = path.join(sensitiveDir, 'folders.rules');
  const commonFile = path.join(sensitiveDir, 'files.common.rules');
  const customFile = path.join(sensitiveDir, 'files.custom.rules');

  const folderLines = loadLines(foldersFile);
  const fileLines = [...loadLines(commonFile), ...loadLines(customFile)];

  const folderPatterns = folderLines.map(globToRegex);
  const filePatterns = fileLines.map(globToRegex);

  return { folderPatterns, filePatterns };
}

export function isSensitivePath(
  filePath: string,
  cfg: FileSensitivityConfig,
): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() || '';

  // 1) Check file patterns against filename
  for (let i = 0; i < cfg.filePatterns.length; i++) {
    const pattern = cfg.filePatterns[i];
    if (pattern.test(fileName)) {
      return true;
    }
  }

  // 2) Check file patterns against full path
  for (let i = 0; i < cfg.filePatterns.length; i++) {
    const pattern = cfg.filePatterns[i];
    if (pattern.test(normalized)) {
      return true;
    }
  }

  // 3) Check folder patterns
  const pathParts = normalized.split('/').filter((p) => p);

  for (const part of pathParts) {
    for (let i = 0; i < cfg.folderPatterns.length; i++) {
      const pattern = cfg.folderPatterns[i];
      if (pattern.test(part)) {
        return true;
      }
    }
  }

  return false;
}

function severityWeight(s: RiskSeverity): number {
  if (s === 'high') return 40;
  if (s === 'medium') return 20;
  return 5;
}

function scanTextForSensitiveData(
  text: string,
  opts: {
    source: 'prompt' | 'assistant' | 'file';
    filePath?: string;
    cwd?: string;
  },
): SensitiveScanResult {
  return {
    hasSensitiveData: false,
    riskScore: 0,
    findings: [],
  };
}

export function scanFileForSensitiveData(
  filePath: string,
  cwd: string,
): SensitiveScanResult {
  const cfg = loadFileSensitivityConfig(cwd);
  const absPath = path.resolve(cwd, filePath);
  const relative = path.relative(cwd, absPath).replace(/\\/g, '/');

  const findings: RiskFinding[] = [];
  let filenameScore = 0;

  if (isSensitivePath(relative, cfg)) {
    findings.push({
      ruleId: 'SENSITIVE_PATH',
      severity: 'high',
      message: `Ścieżka pliku pasuje do wzorca wrażliwego`,
      filePath: relative,
      source: 'file',
      timestamp: new Date().toISOString(),
    });
    filenameScore += 40;
  }

  const riskScore = Math.max(0, Math.min(100, filenameScore));

  return {
    hasSensitiveData: findings.length > 0,
    riskScore,
    findings,
  };
}

// ========================================
// GŁÓWNA FUNKCJA - analyzePromptRealtime
// ========================================

export function analyzePromptRealtime(
  promptText: string,
  cwd: string,
): PromptRiskResult {
  const res = scanTextForSensitiveData(promptText, { source: 'prompt', cwd });

  const findings = [...res.findings];
  let riskScore = res.riskScore;

  const linkRegex = /\[.*?\]\((.*?)\)/g;
  let match;
  const referencedFiles = new Set<string>();

  while ((match = linkRegex.exec(promptText)) !== null) {
    if (match[1]) {
      const filePath = match[1].trim();
      referencedFiles.add(filePath);
    }
  }

  const cfg = loadFileSensitivityConfig(cwd);

  for (const filePath of referencedFiles) {
    if (filePath.startsWith('http') || filePath.includes('://')) {
      continue;
    }

    const normalized = filePath.replace(/\\/g, '/');
    const fileName = normalized.split('/').pop() || '';

    const isSensitive = isSensitivePath(normalized, cfg);

    if (isSensitive) {
      findings.push({
        ruleId: 'SENSITIVE_PATH_IN_PROMPT',
        severity: 'high',
        message: `Użytkownik dołączył plik o wrażliwej nazwie: "${fileName}"`,
        filePath: normalized,
        snippet: `[${fileName}](${filePath})`,
        source: 'prompt',
        timestamp: new Date().toISOString(),
      });
      riskScore = Math.max(riskScore, 40);
    }

    try {
      const absPath = path.resolve(cwd, filePath);

      if (!existsSync(absPath)) {
        continue;
      }

      const fileRes = scanFileForSensitiveData(filePath, cwd);

      if (fileRes.hasSensitiveData) {
        findings.push(
          ...fileRes.findings.map((f) => ({
            ...f,
            message: `(Referenced File) ${f.message}`,
            snippet:
              f.snippet ||
              `File referenced in prompt: [${fileName}](${filePath})`,
          })),
        );
        riskScore = Math.max(riskScore, fileRes.riskScore);
      }
    } catch (e) {
      // ignore error
    }
  }

  return {
    hasSensitiveData: findings.length > 0,
    riskScore,
    findings,
    promptText,
  };
}

// --- LEGACY COMPATIBILITY ---

const defaultContentRules: RiskRule[] = [];

export function loadRiskRules(cwd: string): RiskRule[] {
  return defaultContentRules;
}

export function analyzeRisks(
  input: {
    userPrompts: UserPrompt[];
    assistantMessages: AssistantMessage[];
    fileEdits: FileEdit[];
  },
  rules: RiskRule[],
): AnalyzeResult {
  return {
    score: 0,
    findings: [],
  };
}

export function checkPromptBeforeSend(
  promptText: string,
  cwd: string,
  sessionId?: string,
): any {
  const res = analyzePromptRealtime(promptText, cwd);
  const hasHighRisk = res.findings.some((f) => f.severity === 'high');

  return {
    allowed: !hasHighRisk,
    riskScore: res.riskScore,
    findings: res.findings,
  };
}
