export interface PVCConfig {
  remote: {
    url: string;
  };
  createdAt: string;
  lastSessionId: string;
  userId: string;
  username: string;
  workspaceId: string;
}

export interface FileEdit {
  timestamp: string;
  path: string;
  oldContent: string;
  newContent: string;
  isNewFile: boolean; // ← DODAJ TO
}
export interface UserPrompt {
  timestamp: string;
  text: string;
  context?: string;
  activeFile?: string;
  activeSelection?: string;
  openTabs?: string[];
}

export interface AssistantMessage {
  timestamp: string;
  text: string;
}

export interface Reasoning {
  timestamp: string;
  summary: string;
  encrypted: string;
}

export interface ShellCommand {
  timestamp: string;
  command: string;
}

export interface Patch {
  timestamp: string;
  patch: string;
}

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RiskRule {
  id: string;
  description: string;
  severity: RiskSeverity;
  // where rule applies:
  //  - 'content'  → regex against text
  //  - 'filename' → regex/glob against file path
  //  - 'folder'   → regex/glob against folder path
  scope: 'content' | 'filename' | 'folder';
  pattern?: string;
  // Legacy support (optional)
  flags?: string;
  scopes?: string[];
}

export interface RiskFinding {
  ruleId: string;
  severity: RiskSeverity;
  message: string;
  snippet?: string;
  filePath?: string;
  line?: number;
  source: 'prompt' | 'file' | 'assistant';
  timestamp: string;
  // Legacy support (optional)
  sourceType?: string;
  sourceId?: string;
  blocked?: boolean;
}

export interface SensitiveScanResult {
  hasSensitiveData: boolean;
  riskScore: number; // 0 – 100
  findings: RiskFinding[];
}

export interface RiskSummary {
  maxScore: number;
  totalFindings: number;
  findings: RiskFinding[];
}

export interface AnalyzeResult {
  score: number;
  findings: RiskFinding[];
}

export interface SessionReport {
  sessionId: string;
  cwd: string;
  generatedAt: string;
  events: any[];
  userPrompts: UserPrompt[];
  assistantMessages: AssistantMessage[];
  reasonings: Reasoning[];
  patches: Patch[];
  shellCommands: ShellCommand[];
  fileEdits: FileEdit[];
  riskScore: number; // Keep for backward compatibility or update to use riskSummary
  findings: RiskFinding[]; // Keep for backward compatibility
  riskSummary?: RiskSummary;
}

export interface GenerateReportResult {
  jsonPath: string;
  mdPath: string;
}

export interface Checkpoint {
  sessionId: string;
  lastTimestamp: string;
  lastReportAt: string;
  lastReport: string;
}
