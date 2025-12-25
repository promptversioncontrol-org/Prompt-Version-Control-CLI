import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  getPVCDir,
  getReportsDir,
  getConfigPath,
} from '../utils/path-utils.js';
import type { PVCConfig } from '../types/index.js';

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
      remote: { url: '' },
      createdAt: new Date().toISOString(),
      lastSessionId: '',
      userId: '',
      username: '',
      workspaceId: '',
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  // Create reports directory
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  // Create rules directory and default file
  const rulesDir = path.join(pvcDir, 'rules');
  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true });
  }

  const rulesContent = [
    '# -- Folders --',
    'node_modules',
    'dist',
    'build',
    '.git',
    '.pvc',
    'coverage',
    '',
    '# -- Files --',
    '.env',
    '.env.*',
    'id_rsa',
    'id_rsa.pub',
    '*.pem',
    '*.key',
    '*.p12',
    '*.pfx',
    '*.keystore',
  ].join('\n');

  const rulesPath = path.join(rulesDir, 'pvc.rules');
  if (!existsSync(rulesPath)) {
    writeFileSync(rulesPath, rulesContent);
  }

  console.log('✔ PVC initialized');
  console.log(`Created: ${pvcDir}`);
  console.log(`Rules generated in: ${rulesPath}`);
}
