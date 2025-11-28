import { scanTextForSensitiveData } from './risk-analysis/prompt-check';
import { SENSITIVE_PATTERNS } from './risk-analysis/gitleaks-rules';
import * as fs from 'fs';
import * as path from 'path';

const examplesPath = path.join(process.cwd(), 'sensitive_examples.txt');
const examplesContent = fs.readFileSync(examplesPath, 'utf-8');
const lines = examplesContent.split('\n');

console.log('🔍 Testing Sensitive Data Detection Rules...\n');

let passed = 0;
let failed = 0;

// Map specific lines to expected rules (heuristic based on line content)
// This helps us know what *should* have been detected.
const expectedDetections: Record<number, string> = {
  1: 'aws-access-token',
  2: 'aws-secret-key',
  3: 'aws-secret-key', // or session token if we had a rule for it
  4: 'azure-core-keys', // We don't have this rule in the list I saw? Let's check.
  5: 'gcp-api-key', // We don't have this rule?
  6: 'gcp-service-account',
  7: 'RSA-PK',
  8: 'OPENSSH-PK',
  9: 'PGP-PK',
  10: 'SSH-EC-PK',
  11: 'github-pat',
  12: 'github-oauth',
  13: 'slack-access-token',
  14: 'slack-web-hook',
  15: 'stripe-access-token',
  16: 'sendgrid-api-token',
  17: 'mailgun-private-api-token',
  18: 'npm-access-token',
  19: 'generic-api-key', // MongoDB URI might match generic or specific?
  20: 'generic-api-key',
  21: 'generic-api-key',
  22: 'generic-api-key', // Password assignment
  23: 'generic-api-key', // Basic Auth
  24: 'generic-api-key', // JWT
  25: 'email',
  26: 'credit-card', // We don't have this rule?
  27: 'ssn', // We don't have this rule?
  28: 'generic-api-key',
  29: 'generic-api-key',
  30: 'generic-api-key',
};

lines.forEach((line, index) => {
  if (!line.trim()) return;
  const lineNum = index + 1;

  const result = scanTextForSensitiveData(line, { source: 'prompt' });

  if (result.hasSensitiveData) {
    console.log(
      `✅ Line ${lineNum}: Detected ${result.findings.map((f) => f.ruleId).join(', ')}`,
    );
    passed++;
  } else {
    console.log(
      `❌ Line ${lineNum}: NO DETECTION. Content: "${line.substring(0, 50)}..."`,
    );
    failed++;

    // Debug specific rules against this line to see why they failed
    // For example, check RSA-PK against line 7
    if (lineNum === 7) {
      const rsaRule = SENSITIVE_PATTERNS.find((r) => r.id === 'RSA-PK');
      if (rsaRule) {
        console.log(
          `   Debug RSA-PK: Pattern: ${rsaRule.pattern}, Test: ${rsaRule.pattern.test(line)}`,
        );
      }
    }
  }
});

console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
