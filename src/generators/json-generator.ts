import type { SessionReport } from '../types/index.js';

export function generateJSONReport(report: SessionReport): string {
  return JSON.stringify(report, null, 2);
}
