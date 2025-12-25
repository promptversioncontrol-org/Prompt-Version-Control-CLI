import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { findCodexSessionFile } from '../utils/file-finder.js';
import {
  parseJSONLFile,
  extractUserPrompts,
  extractAssistantMessages,
  extractReasonings,
  extractShellCommands,
  extractPatches,
  extractFileEdits,
} from '../utils/jsonl-parser.js';
import { generateMarkdownReport } from '../generators/markdown-generator.js';
import { generateJSONReport } from '../generators/json-generator.js';
import {
  getReportsDir,
  ensureDirectoryExists,
  getPVCDir,
  getReportDir,
} from '../utils/path-utils.js';
import {
  loadCheckpoint,
  saveCheckpoint,
  getLastTimestamp,
} from '../utils/checkpoint.js';
import type {
  SessionReport,
  GenerateReportResult,
  RiskSummary,
  RiskFinding,
} from '../types/index.js';
import {
  loadRiskRules,
  analyzeRisks,
  analyzePromptRealtime,
  scanFileForSensitiveData,
} from '../risk-analysis/index.js';

interface GenerateOptions {
  lastCount?: number;
}

function buildRiskSummary(report: SessionReport): RiskSummary {
  const allFindings: RiskFinding[] = [];
  let maxScore = 0;

  for (const p of report.userPrompts) {
    const res = analyzePromptRealtime(p.text || '', report.cwd);
    allFindings.push(...res.findings);
    maxScore = Math.max(maxScore, res.riskScore);
  }

  for (const edit of report.fileEdits) {
    const res = scanFileForSensitiveData(edit.path, report.cwd);
    allFindings.push(...res.findings);
    maxScore = Math.max(maxScore, res.riskScore);
  }

  return {
    maxScore,
    totalFindings: allFindings.length,
    findings: allFindings,
  };
}

export async function generateReportCommand(
  sessionId: string,
  reportName: string,
  cwd: string,
  options?: GenerateOptions,
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

  // Extract data from all events
  const userPrompts = extractUserPrompts(allEvents);
  const assistantMessages = extractAssistantMessages(allEvents);
  const reasonings = extractReasonings(allEvents);
  const patches = extractPatches(allEvents);
  const shellCommands = extractShellCommands(allEvents);
  const fileEdits = extractFileEdits(allEvents);

  // Filter if lastCount is provided
  let filteredPrompts = userPrompts;
  let filteredMessages = assistantMessages;

  if (options?.lastCount) {
    filteredPrompts = userPrompts.slice(-options.lastCount);
    // Rough heuristic: keep matching assistant messages
    filteredMessages = assistantMessages.slice(-options.lastCount);
  }

  const nowIso = new Date().toISOString();

  const report: SessionReport = {
    sessionId,
    cwd,
    generatedAt: nowIso,
    events: allEvents, // We might want to filter events too if report is huge
    userPrompts: filteredPrompts,
    assistantMessages: filteredMessages,
    reasonings,
    patches,
    shellCommands,
    fileEdits,
    riskScore: 0, // Legacy
    findings: [], // Legacy
  };

  // Calculate Risk Summary
  const riskSummary = buildRiskSummary(report);
  report.riskSummary = riskSummary;
  report.riskScore = riskSummary.maxScore; // Backwards compatibility
  report.findings = riskSummary.findings; // Backwards compatibility

  // Create dedicated folder for this report inside session reports directory
  const timestamp = nowIso.replace(/[:.]/g, '-');
  const safeName = reportName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const reportDirName = `${timestamp}-${safeName}`;
  const reportDir = path.join(sessionReportsDir, reportDirName);

  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const jsonPath = path.join(reportDir, 'report.json');
  const mdPath = path.join(reportDir, 'report.md');

  // Generate content
  const jsonContent = generateJSONReport(report);
  // Pass reportName to markdown generator if it accepts it, otherwise just report
  const mdContent = generateMarkdownReport(report, reportName);

  writeFileSync(jsonPath, jsonContent, 'utf-8');
  writeFileSync(mdPath, mdContent, 'utf-8');

  // Update checkpoint with the latest timestamp from all events seen so far
  const lastTimestamp = getLastTimestamp(allEvents);
  saveCheckpoint(sessionReportsDir, {
    sessionId,
    lastTimestamp,
    lastReportAt: nowIso,
    lastReport: reportDirName,
  });

  return { jsonPath, mdPath };
}
