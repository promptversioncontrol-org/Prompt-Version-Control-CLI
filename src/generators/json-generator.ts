import type { SessionReport } from "../types";

export function generateJSONReport(report: SessionReport): string {
  return JSON.stringify(report, null, 2);
}

