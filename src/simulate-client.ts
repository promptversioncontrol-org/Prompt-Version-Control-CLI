import { checkPromptBeforeSend } from './utils/risk-analyzer';
import path from 'path';

// This script simulates a client application (like an IDE plugin or a chatbot)
// that wants to send a prompt to an LLM but first checks it with PVC.

const args = process.argv.slice(2);
const promptText = args[0];
const sessionId = args[1] || 'test-session';

if (!promptText) {
  console.error('Usage: bun run src/simulate-client.ts "<prompt>" [sessionId]');
  process.exit(1);
}

console.log(`🤖 Client: Preparing to send prompt: "${promptText}"`);
console.log(`   Session ID: ${sessionId}`);

// 1. CHECK BEFORE SEND
// In a real app, 'cwd' would be the project root where .pvc/rules.json resides.
const cwd = process.cwd();
const result = checkPromptBeforeSend(promptText, cwd, sessionId);

if (!result.allowed) {
  // 2. BLOCK AND NOTIFY
  console.error('\n⛔ BLOCKED! The prompt contains sensitive data.');
  console.error('   Risk Score:', result.riskScore);
  console.error('   Findings:');
  result.findings.forEach((f) => {
    console.error(
      `   - [${f.severity.toUpperCase()}] ${f.ruleId}: ${f.message}`,
    );
  });

  // Do NOT send to LLM
  process.exit(1);
}

// 3. SEND TO LLM (Simulated)
console.log('\n✅ Allowed. Sending to LLM...');
// await api.send(promptText)...
console.log('   (Simulated send complete)');
