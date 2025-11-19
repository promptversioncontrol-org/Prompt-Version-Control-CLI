import path from "path";
import { existsSync } from "fs";

export function getPVCDir(cwd: string): string {
  return path.join(cwd, ".pvc");
}

export function getReportsDir(cwd: string): string {
  return path.join(getPVCDir(cwd), "reports");
}

export function getConfigPath(cwd: string): string {
  return path.join(getPVCDir(cwd), "config.json");
}

export function getCodexSessionsRoot(): string | null {
  const userProfile = process.env.USERPROFILE || process.env.HOME;
  if (!userProfile) return null;

  const sessionRoot = path.join(userProfile, ".codex", "sessions");
  return existsSync(sessionRoot) ? sessionRoot : null;
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    throw new Error(`Directory does not exist: ${dirPath}`);
  }
}

