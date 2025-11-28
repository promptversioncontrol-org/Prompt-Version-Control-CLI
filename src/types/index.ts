export interface PVCConfig {
  remote: {
    url: string;
  };
  createdAt: string;
  lastSessionId: string;
  userId: string;
  username: string;
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
