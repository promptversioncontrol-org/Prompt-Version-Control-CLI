import type { SensitiveScanResult, RiskFinding } from '../types/index.js';
import { SENSITIVE_PATTERNS } from './gitleaks-rules.js';

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
    // Create a new regex with global flag
    const flags = rule.pattern.flags.includes('g')
      ? rule.pattern.flags
      : rule.pattern.flags + 'g';
    const globalPattern = new RegExp(rule.pattern.source, flags);

    // Reset lastIndex before each scan
    globalPattern.lastIndex = 0;

    let match;
    const seenMatches = new Set<string>(); // Prevent duplicate findings

    // Use a loop to find ALL occurrences
    while ((match = globalPattern.exec(text)) !== null) {
      const matchedText = match[0];
      const matchKey = `${rule.id}:${matchedText}:${match.index}`;

      // Skip if we've already recorded this exact match at this position
      if (seenMatches.has(matchKey)) {
        // Prevent infinite loops
        if (match.index === globalPattern.lastIndex) {
          globalPattern.lastIndex++;
        }
        continue;
      }

      seenMatches.add(matchKey);

      // Map 'critical' to 'high' for RiskFinding type compatibility
      const severity = rule.severity === 'critical' ? 'high' : rule.severity;

      findings.push({
        ruleId: rule.id,
        severity: severity as 'high' | 'medium' | 'low',
        message: rule.message,
        snippet: matchedText,
        source: opts.source,
        timestamp: new Date().toISOString(),
      });

      // Calculate risk score
      if (severity === 'high' || rule.severity === 'critical') {
        totalScore += 40;
      } else if (severity === 'medium') {
        totalScore += 20;
      } else {
        totalScore += 5;
      }

      // Prevent infinite loops if the regex matches empty strings
      if (match.index === globalPattern.lastIndex) {
        globalPattern.lastIndex++;
      }
    }
  }

  return {
    hasSensitiveData: findings.length > 0,
    riskScore: Math.min(100, totalScore),
    findings,
  };
}

// Helper function to test scanner accuracy
export function testScannerAccuracy(testCases: string[]): {
  totalTests: number;
  detected: number;
  missed: number;
  accuracy: number;
  missedPatterns: string[];
} {
  const results = {
    totalTests: testCases.length,
    detected: 0,
    missed: 0,
    accuracy: 0,
    missedPatterns: [] as string[],
  };

  testCases.forEach((testCase, index) => {
    const scanResult = scanTextForSensitiveData(testCase, { source: 'prompt' });

    if (scanResult.hasSensitiveData) {
      results.detected++;
    } else {
      results.missed++;
      results.missedPatterns.push(
        `Test case ${index + 1}: ${testCase.substring(0, 50)}...`,
      );
    }
  });

  results.accuracy = (results.detected / results.totalTests) * 100;

  return results;
}
