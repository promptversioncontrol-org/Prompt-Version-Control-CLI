import { readdirSync, existsSync } from "fs";
import path from "path";
import { getCodexSessionsRoot } from "./path-utils";

export function findCodexSessionFile(sessionId: string): string | null {
  const codexRoot = getCodexSessionsRoot();
  if (!codexRoot) return null;

  let foundFile: string | null = null;

  function walkDirectory(dir: string): boolean {
    if (!existsSync(dir)) return false;

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (walkDirectory(fullPath)) return true;
        continue;
      }

      // Check if file matches pattern: rollout-*.jsonl and contains sessionId
      if (
        entry.name.startsWith("rollout-") &&
        entry.name.endsWith(".jsonl") &&
        entry.name.includes(sessionId)
      ) {
        foundFile = fullPath;
        return true;
      }
    }

    return false;
  }

  walkDirectory(codexRoot);
  return foundFile;
}

