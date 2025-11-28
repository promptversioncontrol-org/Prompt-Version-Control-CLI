import type { SensitiveScanResult, RiskFinding } from '../types';
import { SENSITIVE_PATTERNS } from './gitleaks-rules';

export function scanTextForSensitiveData(
  text: string,
  opts: {
    source: 'prompt' | 'assistant' | 'file';
    filePath?: string;
    cwd?: string;
  },
): SensitiveScanResult {
  const findings: RiskFinding[] = [];
  let totalScore = 0;

  for (const rule of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global regexes
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(text);
    if (match) {
      // Map 'critical' to 'high' for now as RiskFinding type might not support 'critical'
      // Or update RiskFinding type. Assuming 'high' is max for now.
      const severity = rule.severity === 'critical' ? 'high' : rule.severity;

      findings.push({
        ruleId: rule.id,
        severity: severity as 'high' | 'medium' | 'low',
        message: rule.message,
        snippet: match[0],
        source: opts.source,
        timestamp: new Date().toISOString(),
      });

      if (severity === 'high') totalScore += 40;
      else if (severity === 'medium') totalScore += 20;
      else totalScore += 5;
    }
  }

  return {
    hasSensitiveData: findings.length > 0,
    riskScore: Math.min(100, totalScore),
    findings,
  };
}
