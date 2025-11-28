import path from 'path';
import {
  loadFileSensitivityConfig,
  type FileSensitivityConfig,
} from './config';
import type { RiskFinding, SensitiveScanResult } from '../types';

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
