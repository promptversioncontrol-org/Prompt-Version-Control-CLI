import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
  mkdirSync,
} from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { findCodexSessionFile } from '../utils/file-finder';
import {
  getPVCDir,
  getConfigPath,
  getReportsDir,
  getDailyReportDir,
} from '../utils/path-utils';
import {
  parseJSONLFile,
  extractUserPrompts,
  extractAssistantMessages,
  extractFileEdits,
} from '../utils/jsonl-parser';
import { generateMarkdownReport } from '../generators/markdown-generator';
import {
  loadCheckpoint,
  saveCheckpoint,
  getLastTimestamp,
} from '../utils/checkpoint';
import type { SessionReport } from '../types';
import { loadRiskRules, analyzeRisks } from '../risk-analysis/index';
import {
  loadBlockedPromptsForSession,
  getBlockedLogPath,
} from '../utils/blocked-prompts';
import { RealTimeReporter } from '../utils/socket-client';

interface PVCConfigFile {
  remote?: { url?: string };
  lastSessionId?: string;
  sessionToken?: string;
  workspaceId?: string;
  username?: string;
}

function readConfig(cwd: string): PVCConfigFile {
  const configPath = getConfigPath(cwd);
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as PVCConfigFile;
  } catch {
    return {};
  }
}

function getPidPath(cwd: string): string {
  return path.join(getPVCDir(cwd), 'watch.pid');
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getWatchDir(cwd: string, sessionId: string): string {
  const watchDir = getDailyReportDir(cwd, sessionId);

  if (!existsSync(watchDir)) {
    mkdirSync(watchDir, { recursive: true });
  }

  return watchDir;
}

// clearWatchDir and getExistingWatchDir are no longer needed

function getReportFilePaths(
  cwd: string,
  sessionId: string,
): { jsonPath: string; mdPath: string } {
  const watchDir = getWatchDir(cwd, sessionId);

  return {
    jsonPath: path.join(watchDir, 'report.json'),
    mdPath: path.join(watchDir, 'report.md'),
  };
}

function updateJsonFile(jsonPath: string, report: SessionReport) {
  if (existsSync(jsonPath)) {
    const existingJson = readFileSync(jsonPath, 'utf-8');
    let existingData: any;

    try {
      existingData = JSON.parse(existingJson);
    } catch {
      existingData = { updates: [] };
    }

    if (!Array.isArray(existingData.updates)) {
      existingData = { updates: [existingData] };
    }

    existingData.updates.push(report);
    writeFileSync(jsonPath, JSON.stringify(existingData, null, 2), 'utf-8');
  } else {
    writeFileSync(
      jsonPath,
      JSON.stringify({ updates: [report] }, null, 2),
      'utf-8',
    );
  }
}
async function updateReports(
  cwd: string,
  sessionId: string,
  sessionFile: string,
  reporter: RealTimeReporter,
  username: string,
) {
  console.log('\n🔥 ========== UPDATE REPORTS START ========== 🔥');

  const reportsRootDir = getReportsDir(cwd);
  const sessionReportsDir = path.join(reportsRootDir, sessionId);

  if (!existsSync(sessionReportsDir)) {
    mkdirSync(sessionReportsDir, { recursive: true });
  }

  // Parse all events
  const allEvents = parseJSONLFile(sessionFile);

  // Load checkpoint and filter to only NEW events
  const checkpoint = loadCheckpoint(sessionReportsDir);

  let events = allEvents;

  if (checkpoint?.lastTimestamp) {
    const last = new Date(checkpoint.lastTimestamp).getTime();
    events = allEvents.filter((e) => {
      if (!e.timestamp) return false;
      return new Date(e.timestamp).getTime() > last;
    });

    if (events.length === 0) {
      console.log('ℹ️  No new events since last checkpoint');
      return;
    }

    console.log(
      `📊 Found ${events.length} new events (${allEvents.length} total)`,
    );
  } else {
    if (events.length > 0) {
      console.log(`📊 Processing ${events.length} events (first watch run)`);
    }
  }

  // Extract data ONLY from new events
  const userPrompts = extractUserPrompts(events);
  const assistantMessages = extractAssistantMessages(events);
  const fileEdits = extractFileEdits(events);

  // Check for blocked prompts
  const blockedEvents = loadBlockedPromptsForSession(cwd, sessionId);
  console.log(`🚫 Blocked events loaded: ${blockedEvents.length}`);

  let newBlockedCount = 0;
  if (checkpoint?.lastTimestamp) {
    const last = new Date(checkpoint.lastTimestamp).getTime();
    for (const ev of blockedEvents) {
      if (new Date(ev.timestamp).getTime() > last) {
        console.log(`\n🚫 BLOCKED PROMPT: ${ev.prompt.slice(0, 60)}...`);
        newBlockedCount++;
      }
    }
  }

  if (events.length === 0 && newBlockedCount === 0) {
    console.log('ℹ️  No new events or blocked prompts since last checkpoint');
    return;
  }

  // ========================================
  // 🔥 RISK ANALYSIS - TUTAJ WYWOŁUJEMY!
  // ========================================
  // ========================================
  // 🔥 RISK ANALYSIS
  // ========================================
  const allFindings: any[] = [];
  let maxScore = 0;

  const { analyzePromptRealtime, scanFileForSensitiveData } =
    await import('../risk-analysis/index');

  for (const p of userPrompts) {
    const res = analyzePromptRealtime(p.text || '', cwd);

    allFindings.push(...res.findings);
    maxScore = Math.max(maxScore, res.riskScore);

    if (res.findings.length > 0) {
      console.log(`\n⚠️  Risk detected in prompt:`);
      res.findings.forEach((f) => {
        const icon =
          f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟠' : '🟡';
        console.log(`   ${icon} [${f.severity}] ${f.ruleId}: ${f.message}`);

        reporter.reportLeak({
          sessionId,
          ruleId: f.ruleId,
          severity: f.severity,
          message: f.message,
          snippet: f.snippet,
          source: 'prompt',
          timestamp: new Date().toISOString(),
          username,
        });
      });
    }
  }

  for (const edit of fileEdits) {
    const res = scanFileForSensitiveData(edit.path, cwd);
    allFindings.push(...res.findings);
    maxScore = Math.max(maxScore, res.riskScore);

    if (res.findings.length > 0) {
      console.log(`\n⚠️  Risk detected in file: ${edit.path}`);
      res.findings.forEach((f) => {
        const icon =
          f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟠' : '🟡';
        console.log(`   ${icon} [${f.severity}] ${f.ruleId}: ${f.message}`);

        reporter.reportLeak({
          sessionId,
          ruleId: f.ruleId,
          severity: f.severity,
          message: f.message,
          snippet: f.snippet,
          source: 'file',
          timestamp: new Date().toISOString(),
          username,
        });
      });
    }
  }

  // Blocked findings
  const blockedFindings = blockedEvents.flatMap((ev) =>
    ev.findings.map((f) => ({
      ...f,
      blocked: true,
      message:
        f.message ||
        `User attempted to send a sensitive prompt (blocked) in session ${sessionId}.`,
    })),
  );

  const mergedFindings = [...allFindings, ...blockedFindings];
  const mergedScore = Math.max(
    maxScore,
    ...blockedEvents.map((ev) => ev.riskScore),
    0,
  );

  const nowIso = new Date().toISOString();

  // Create report with ONLY new events
  const report: SessionReport = {
    sessionId,
    cwd,
    generatedAt: nowIso,
    events,
    userPrompts,
    assistantMessages,
    reasonings: [],
    patches: [],
    shellCommands: [],
    fileEdits,
    riskScore: mergedScore, // Legacy
    findings: mergedFindings, // Legacy
    riskSummary: {
      maxScore: mergedScore,
      totalFindings: mergedFindings.length,
      findings: mergedFindings,
    },
  };

  const { jsonPath, mdPath } = getReportFilePaths(cwd, sessionId);
  const findingsPath = path.join(path.dirname(jsonPath), 'findings.json');

  // Update cumulative findings.json
  if (mergedFindings.length > 0) {
    let existingFindings: any[] = [];
    if (existsSync(findingsPath)) {
      try {
        existingFindings = JSON.parse(readFileSync(findingsPath, 'utf-8'));
      } catch {
        existingFindings = [];
      }
    }

    // Append new findings
    const updatedFindings = [...existingFindings, ...mergedFindings];
    writeFileSync(
      findingsPath,
      JSON.stringify(updatedFindings, null, 2),
      'utf-8',
    );
    console.log(`   🚨 Findings updated: ${findingsPath}`);
  }

  // Generate new content for this update
  const newMdContent = generateMarkdownReport(report);

  // APPEND MODE: add new content to existing files
  if (checkpoint?.lastTimestamp) {
    if (existsSync(mdPath)) {
      const existingMd = readFileSync(mdPath, 'utf-8');

      // Wyciągnij tylko timeline z nowego contentu
      const timelineStart = newMdContent.indexOf('## Session Timeline');
      const timelineContent =
        timelineStart !== -1
          ? newMdContent
              .substring(timelineStart + '## Session Timeline'.length)
              .trim()
          : newMdContent;

      // ZAWSZE dopisuj nowe zdarzenia do końca pliku bez nagłówka "Update at"
      writeFileSync(mdPath, existingMd + '\n\n' + timelineContent, 'utf-8');
    } else {
      // Pierwszy zapis
      writeFileSync(mdPath, newMdContent, 'utf-8');
    }

    // JSON - zawsze jako array updates
    updateJsonFile(jsonPath, report);
  } else {
    // First run: create new files
    writeFileSync(mdPath, newMdContent, 'utf-8');
    writeFileSync(
      jsonPath,
      JSON.stringify({ updates: [report] }, null, 2),
      'utf-8',
    );
  }

  console.log(`✅ Reports updated`);
  console.log(`   📄 JSON: ${jsonPath}`);
  console.log(`   📝 MD: ${mdPath}`);

  // Update checkpoint with latest timestamp from ALL events
  const lastTimestamp = getLastTimestamp(allEvents);
  const watchDir = getWatchDir(cwd, sessionId);
  const watchDirName = path.basename(watchDir);

  saveCheckpoint(sessionReportsDir, {
    sessionId,
    lastTimestamp,
    lastReportAt: nowIso,
    lastReport: watchDirName,
  });

  // Send to backend
  // await sendToBackend(cwd, sessionId, jsonPath, mdPath);
}

function createZipArchive(files: string[], cwd: string): Buffer {
  const tempZip = path.join(getPVCDir(cwd), `watch-report-${Date.now()}.zip`);

  if (process.platform === 'win32') {
    const ps = spawnSync(
      'powershell',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Compress-Archive -Path ${files.map((f) => `"${f}"`).join(',')} -DestinationPath "${tempZip}" -Force`,
      ],
      {
        windowsHide: true,
        stdio: 'pipe',
      },
    );
    if (ps.status !== 0) {
      throw new Error(
        `Compress-Archive failed: ${ps.stderr?.toString() || ps.status}`,
      );
    }
  } else {
    const zip = spawnSync('zip', ['-j', tempZip, ...files]);
    if (zip.status !== 0) {
      throw new Error(`zip failed: ${zip.stderr?.toString() || zip.status}`);
    }
  }

  const buf = readFileSync(tempZip);
  try {
    unlinkSync(tempZip);
  } catch {
    // ignore
  }
  return buf;
}

async function sendToBackend(
  cwd: string,
  sessionId: string,
  jsonPath: string,
  mdPath: string,
) {
  const cfg = readConfig(cwd);
  const endpoint = cfg.remote?.url;

  if (!endpoint) {
    console.log('ℹ️ No backend URL configured (remote.url). Skipping upload.');
    return;
  }

  try {
    const zipBuffer = createZipArchive([jsonPath, mdPath], cwd);

    const form = new (globalThis as any).FormData();
    form.append('sessionId', sessionId);
    form.append('cwd', cwd);
    form.append('timestamp', new Date().toISOString());
    form.append(
      'uploadedFile',
      new (globalThis as any).Blob([zipBuffer], { type: 'application/zip' }),
      `watch-${sessionId}.zip`,
    );

    const response = await fetch('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: form,
    });

    if (response.ok) {
      console.log('✅ Report uploaded to backend');
    } else {
      console.error(
        `❌ Backend error ${response.status}: ${await response.text()}`,
      );
    }
  } catch (error) {
    console.error('❌ Failed to send to backend:', error);
  }
}

async function runWatchLoop(
  cwd: string,
  sessionId: string,
  intervalMs: number = 3000,
) {
  const watchDir = getWatchDir(cwd, sessionId);
  const watchDirName = path.basename(watchDir);

  console.log(`👁️  Watching session: ${sessionId}`);
  console.log(`📁 Watch folder: ${watchDirName}`);
  console.log(`⏱️  Checking every ${intervalMs}ms`);
  console.log(`🛑 Stop with: pvc watch stop\n`);

  console.log(`🛑 Stop with: pvc watch stop\n`);

  const config = readConfig(cwd);
  console.log('🔧 Loaded config:', {
    ...config,
    sessionToken: config.sessionToken ? '***' : 'undefined',
    workspaceId: config.workspaceId,
  });

  const reporter = new RealTimeReporter(
    'http://localhost:3000',
    {
      token: config.sessionToken,
      workspaceId: config.workspaceId,
    },
    '/api/socket/io',
  );

  let lastMtime = 0;
  let lastBlockedMtime = 0;
  let notFoundCount = 0;

  while (true) {
    try {
      const sessionFile = findCodexSessionFile(sessionId);

      if (!sessionFile) {
        notFoundCount++;
        if (notFoundCount === 1) {
          console.log('⏳ Waiting for session file to appear...');
        }
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }

      if (notFoundCount > 0) {
        console.log(`✅ Session file found: ${sessionFile}\n`);
        notFoundCount = 0;
      }

      const stat = statSync(sessionFile);

      if (stat.mtimeMs > lastMtime) {
        lastMtime = stat.mtimeMs;
        console.log(
          `\n🔔 New activity detected at ${new Date().toLocaleTimeString()}`,
        );
        await updateReports(
          cwd,
          sessionId,
          sessionFile,
          reporter,
          config.username || 'unknown',
        );
        console.log('');
      }

      const blockedPath = getBlockedLogPath(cwd);
      let blockedChanged = false;
      if (existsSync(blockedPath)) {
        const bStat = statSync(blockedPath);
        if (bStat.mtimeMs > lastBlockedMtime) {
          lastBlockedMtime = bStat.mtimeMs;
          blockedChanged = true;
        }
      }

      if (stat.mtimeMs > lastMtime || blockedChanged) {
        lastMtime = stat.mtimeMs;
        console.log(
          `\n🔔 New activity detected at ${new Date().toLocaleTimeString()}`,
        );
        if (blockedChanged) {
          console.log('🚫 (Blocked prompts log updated)');
        }
        await updateReports(
          cwd,
          sessionId,
          sessionFile,
          reporter,
          config.username || 'unknown',
        );
        console.log('');
      }
    } catch (err) {
      console.error(`❌ Error: ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function startDaemon(cwd: string, sessionId: string) {
  const isBun = process.execPath.toLowerCase().includes('bun');
  const entry = process.argv[1];
  const args = isBun
    ? [entry, 'watch', '--daemon', `--session=${sessionId}`]
    : ['watch', '--daemon', `--session=${sessionId}`];

  const child = spawn(process.execPath, args, {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  child.unref();
  writeFileSync(getPidPath(cwd), String(child.pid));
  console.log(`✅ Watch daemon started (PID: ${child.pid})`);
}

async function stopDaemon(cwd: string): Promise<void> {
  const pidPath = getPidPath(cwd);
  if (!existsSync(pidPath)) {
    console.log('ℹ️  No watch daemon running');
    return;
  }

  const pid = Number(readFileSync(pidPath, 'utf8').trim());

  if (!pid || Number.isNaN(pid)) {
    console.log('⚠️  Invalid PID file, removing...');
    unlinkSync(pidPath);
    return;
  }

  if (!isProcessRunning(pid)) {
    console.log('ℹ️  Watch daemon not running (stale PID)');
    unlinkSync(pidPath);
    return;
  }

  try {
    process.kill(pid);
    console.log(`✅ Stopped watch daemon (PID: ${pid})`);
  } catch (error) {
    console.log(`❌ Failed to stop PID ${pid}: ${(error as Error).message}`);
  }

  try {
    unlinkSync(pidPath);
  } catch {
    // ignore
  }

  // After stopping, try to upload the latest report (if exists)
  // if (sessionId) {
  //   const watchDir = getExistingWatchDir(cwd, sessionId);
  //   if (watchDir) {
  //     const jsonPath = path.join(watchDir, "report.json");
  //     const mdPath = path.join(watchDir, "report.md");
  //     if (existsSync(jsonPath) && existsSync(mdPath)) {
  //       await sendToBackend(cwd, sessionId, jsonPath, mdPath);
  //     }
  //     clearWatchDir(cwd, sessionId);
  //     console.log("🗑️  Watch session finalized - next watch will create new folder");
  //   }
  // }
}

export async function watchCommand(cwd: string, args: string[]): Promise<void> {
  const subcommand = args[0];

  if (subcommand === 'stop') {
    await stopDaemon(cwd);
    return;
  }

  if (subcommand === '--daemon') {
    const sessionIdArg = args.find((a) => a.startsWith('--session='));
    const sessionId = sessionIdArg?.replace('--session=', '') || '';

    if (!sessionId) {
      console.error('❌ No session ID provided to daemon');
      process.exit(1);
    }

    await runWatchLoop(cwd, sessionId);
    return;
  }

  // Start mode
  const pidPath = getPidPath(cwd);
  if (existsSync(pidPath)) {
    const pid = Number(readFileSync(pidPath, 'utf8').trim());
    if (pid && isProcessRunning(pid)) {
      console.log(`ℹ️  Watch daemon already running (PID: ${pid})`);
      console.log(`   Use 'pvc watch stop' to stop it`);
      return;
    }
    unlinkSync(pidPath);
  }

  const config = readConfig(cwd);
  const sessionId = config.lastSessionId;

  if (!sessionId) {
    console.error("❌ No session ID found. Run 'pvc update-conv' first.");
    process.exit(1);
  }

  if (args.includes('--detach')) {
    startDaemon(cwd, sessionId);
    return;
  }

  // Foreground mode
  await runWatchLoop(cwd, sessionId);
}
