import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";

export interface Checkpoint {
  sessionId: string;
  lastTimestamp: string;
  lastReportAt: string;
  lastReport: string;
}

export function getCheckpointPath(sessionDir: string): string {
  return path.join(sessionDir, ".checkpoint.json");
}

export function loadCheckpoint(sessionDir: string): Checkpoint | null {
  const checkpointPath = getCheckpointPath(sessionDir);
  
  if (!existsSync(checkpointPath)) {
    return null;
  }

  try {
    const content = readFileSync(checkpointPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to load checkpoint:", error);
    return null;
  }
}

export function saveCheckpoint(sessionDir: string, checkpoint: Checkpoint): void {
  const checkpointPath = getCheckpointPath(sessionDir);
  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), "utf-8");
}

export function getLastTimestamp(events: any[]): string {
  if (events.length === 0) return new Date(0).toISOString();
  
  // Find the latest timestamp from all events
  const timestamps = events
    .map(e => e.timestamp)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  return timestamps[0] || new Date(0).toISOString();
}
