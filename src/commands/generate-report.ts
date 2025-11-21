import { writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { findCodexSessionFile } from "../utils/file-finder";
import {
  parseJSONLFile,
  extractUserPrompts,
  extractAssistantMessages,
  extractReasonings,
  extractShellCommands,
  extractPatches,
  extractFileEdits
} from "../utils/jsonl-parser";
import { generateMarkdownReport } from "../generators/markdown-generator";
import { generateJSONReport } from "../generators/json-generator";
import { getReportsDir, ensureDirectoryExists, getPVCDir } from "../utils/path-utils";
import { loadCheckpoint, saveCheckpoint, getLastTimestamp } from "../utils/checkpoint";
import type { SessionReport, GenerateReportResult } from "../types";

interface GenerateOptions {
  lastCount?: number;
}

export async function generateReportCommand(
  sessionId: string,
  reportName: string,
  cwd: string,
  options?: GenerateOptions
): Promise<GenerateReportResult> {
  // Ensure PVC is initialized
  const pvcDir = getPVCDir(cwd);
  ensureDirectoryExists(pvcDir);

  // Find session file
  const sessionFile = findCodexSessionFile(sessionId);
  if (!sessionFile) {
    throw new Error(`Session file not found for ID: ${sessionId}`);
  }

  console.log(`📂 Found session file: ${sessionFile}`);

  // Parse JSONL file (all events)
  const allEvents = parseJSONLFile(sessionFile);

  // Prepare per-session reports directory (and checkpoint location)
  const reportsRootDir = getReportsDir(cwd);
  if (!existsSync(reportsRootDir)) {
    mkdirSync(reportsRootDir, { recursive: true });
  }

  const sessionReportsDir = path.join(reportsRootDir, sessionId);
  if (!existsSync(sessionReportsDir)) {
    mkdirSync(sessionReportsDir, { recursive: true });
  }

  // Load checkpoint and filter events to only "new" ones
  const checkpoint = loadCheckpoint(sessionReportsDir);
  let events = allEvents;

  if (checkpoint?.lastTimestamp) {
    const last = new Date(checkpoint.lastTimestamp).getTime();
    events = allEvents.filter(e => {
      if (!e.timestamp) return false;
      return new Date(e.timestamp).getTime() > last;
    });
  }

  if (events.length === 0) {
    console.log("ℹ️ No new events since last report; generating empty diff summary.");
  }

  // Extract data from filtered events
  let userPrompts = extractUserPrompts(events);
  let assistantMessages = extractAssistantMessages(events);
  const reasonings = extractReasonings(events);
  const shellCommands = extractShellCommands(events);
  const patches = extractPatches(events);
  const fileEdits = extractFileEdits(events);

  // Optionally limit to last N user/assistant messages
  if (options?.lastCount && options.lastCount > 0) {
    const n = options.lastCount;
    userPrompts = userPrompts.slice(-n);
    assistantMessages = assistantMessages.slice(-n);
  }

  // Use a single timestamp for this report
  const nowIso = new Date().toISOString();

  // Create report object (only with new events)
  const report: SessionReport = {
    sessionId,
    cwd,
    generatedAt: nowIso,
    events,
    userPrompts,
    assistantMessages,
    reasonings,
    patches,
    shellCommands,
    fileEdits
  };

  // Create dedicated folder for this report inside session reports directory
  const timestamp = nowIso.replace(/[:.]/g, "-");
  const safeName = reportName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const reportDirName = `${timestamp}-${safeName}`;
  const reportDir = path.join(sessionReportsDir, reportDirName);

  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const jsonPath = path.join(reportDir, "report.json");
  const mdPath = path.join(reportDir, "report.md");

  const jsonContent = generateJSONReport(report);
  const mdContent = generateMarkdownReport(report);

  writeFileSync(jsonPath, jsonContent, "utf-8");
  writeFileSync(mdPath, mdContent, "utf-8");

  // Update checkpoint with the latest timestamp from all events seen so far
  const lastTimestamp = getLastTimestamp(allEvents);
  saveCheckpoint(sessionReportsDir, {
    sessionId,
    lastTimestamp,
    lastReportAt: nowIso,
    lastReport: reportDirName
  });

  return { jsonPath, mdPath };
}
