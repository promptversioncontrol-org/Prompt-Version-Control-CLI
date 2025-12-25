import os from 'os';
import path from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

export interface GlobalConfig {
  userId?: string;
  username?: string;
  sessionToken?: string;
}

export interface LocalConfig {
  workspaceId?: string;
  remote?: {
    url?: string;
  };
  lastSessionId?: string;
}

export type CombinedConfig = GlobalConfig & LocalConfig;

export class ConfigManager {
  private static getGlobalConfigDir(): string {
    const platform = os.platform();
    if (platform === 'win32' && process.env.APPDATA) {
      return path.join(process.env.APPDATA, 'pvc');
    }
    // Fallback for Mac/Linux or if APPDATA is missing
    return path.join(os.homedir(), '.pvc');
  }

  private static getGlobalConfigPath(): string {
    return path.join(this.getGlobalConfigDir(), 'config.json');
  }

  private static getLocalConfigPath(cwd: string): string {
    return path.join(cwd, '.pvc', 'config.json');
  }

  public static getGlobalConfig(): GlobalConfig {
    const configPath = this.getGlobalConfigPath();
    if (!existsSync(configPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  public static getLocalConfig(cwd: string): LocalConfig {
    const configPath = this.getLocalConfigPath(cwd);
    if (!existsSync(configPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  public static getCombinedConfig(cwd: string): CombinedConfig {
    const globalConfig = this.getGlobalConfig();
    const localConfig = this.getLocalConfig(cwd);
    return { ...globalConfig, ...localConfig };
  }

  public static saveGlobalConfig(config: GlobalConfig): void {
    const configDir = this.getGlobalConfigDir();
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    const current = this.getGlobalConfig();
    const updated = { ...current, ...config };
    writeFileSync(this.getGlobalConfigPath(), JSON.stringify(updated, null, 2));
  }

  public static saveLocalConfig(cwd: string, config: LocalConfig): void {
    const pvcDir = path.join(cwd, '.pvc');
    if (!existsSync(pvcDir)) {
      mkdirSync(pvcDir, { recursive: true });
    }
    const current = this.getLocalConfig(cwd);
    const updated = { ...current, ...config };
    writeFileSync(
      this.getLocalConfigPath(cwd),
      JSON.stringify(updated, null, 2),
    );
  }
}
