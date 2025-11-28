import path from 'path';
import { existsSync } from 'fs';

export function getPVCDir(cwd: string): string {
  return path.join(cwd, '.pvc');
}

export function getReportsDir(cwd: string): string {
  return path.join(getPVCDir(cwd), 'reports');
}

export function getConfigPath(cwd: string): string {
  return path.join(getPVCDir(cwd), 'config.json');
}

export function getCodexSessionsRoot(): string | null {
  const userProfile = process.env.USERPROFILE || process.env.HOME;
  if (!userProfile) return null;

  const sessionRoot = path.join(userProfile, '.codex', 'sessions');
  return existsSync(sessionRoot) ? sessionRoot : null;
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    throw new Error(`Directory does not exist: ${dirPath}`);
  }
}
export function getDailyReportDir(cwd: string, sessionId: string): string {
  const reportsRootDir = getReportsDir(cwd);
  const sessionReportsDir = path.join(reportsRootDir, sessionId);

  // Create folder name based on current UTC date: YYYY-MM-DD
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const dailyDir = path.join(sessionReportsDir, dateStr);
  return dailyDir;
}
