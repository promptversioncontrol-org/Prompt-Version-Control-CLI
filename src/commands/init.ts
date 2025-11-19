import { existsSync, mkdirSync, writeFileSync } from "fs";
import { getPVCDir, getReportsDir, getConfigPath } from "../utils/path-utils";
import type { PVCConfig } from "../types";

export function initCommand(cwd: string): void {
  const pvcDir = getPVCDir(cwd);
  const reportsDir = getReportsDir(cwd);
  const configPath = getConfigPath(cwd);

  // Create .pvc directory
  if (!existsSync(pvcDir)) {
    mkdirSync(pvcDir, { recursive: true });
  }

  // Create config.json
  if (!existsSync(configPath)) {
    const config: PVCConfig = {
      remote: { url: "" },
      createdAt: new Date().toISOString()
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  // Create reports directory
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  console.log("✔ PVC initialized");
  console.log(`Created: ${pvcDir}`);
}

