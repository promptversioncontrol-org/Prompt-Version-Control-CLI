import fs from 'fs';
import path from 'path';
import { getPVCDir } from './path-utils.js';
import type { RiskFinding } from '../types/index.js';

export interface BlockedPromptEvent {
  sessionId: string;
  timestamp: string;
  prompt: string;
  riskScore: number;
  findings: RiskFinding[];
}

export function getBlockedLogPath(cwd: string): string {
  return path.join(getPVCDir(cwd), 'blocked-prompts.jsonl');
}

export function appendBlockedPrompt(
  cwd: string,
  event: BlockedPromptEvent,
): void {
  const filePath = getBlockedLogPath(cwd);
  const line = JSON.stringify(event) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

export function loadBlockedPromptsForSession(
  cwd: string,
  sessionId: string,
): BlockedPromptEvent[] {
  const filePath = getBlockedLogPath(cwd);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  const result: BlockedPromptEvent[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as BlockedPromptEvent;
      if (obj.sessionId === sessionId) {
        result.push(obj);
      }
    } catch {
      // ignoruj złe linie
    }
  }
  return result;
}
