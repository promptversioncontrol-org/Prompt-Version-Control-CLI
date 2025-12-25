import path from 'path';
import { existsSync } from 'fs';
import { loadFileSensitivityConfig } from './config.js';
import { scanFileForSensitiveData, isSensitivePath } from './file-check.js';
import { scanTextForSensitiveData } from './prompt-check.js';
import type {
  RiskRule,
  UserPrompt,
  AssistantMessage,
  FileEdit,
  AnalyzeResult,
  SensitiveScanResult,
} from '../types/index.js';

export interface PromptRiskResult extends SensitiveScanResult {
  promptText: string;
}

// Re-export for external use
export { scanFileForSensitiveData, loadFileSensitivityConfig, isSensitivePath };

// ========================================
// MAIN FUNCTION - analyzePromptRealtime
// ========================================

export function analyzePromptRealtime(
  promptText: string,
  cwd: string,
): PromptRiskResult {
  // 1. Scan the text itself (Regex)
  const res = scanTextForSensitiveData(promptText, { source: 'prompt', cwd });

  const findings = [...res.findings];
  let riskScore = res.riskScore;

  // 2. Scan for file references (Markdown links)
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
