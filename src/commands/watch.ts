import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { findCodexSessionFile } from "../utils/file-finder";
import { getPVCDir, getConfigPath, getReportsDir } from "../utils/path-utils";
import { parseJSONLFile, extractUserPrompts, extractAssistantMessages, extractFileEdits } from "../utils/jsonl-parser";
import { generateMarkdownReport } from "../generators/markdown-generator";
import { generateJSONReport } from "../generators/json-generator";
import { loadCheckpoint, saveCheckpoint, getLastTimestamp } from "../utils/checkpoint";
import type { SessionReport } from "../types";

interface PVCConfigFile {
  remote?: { url?: string };
  lastSessionId?: string;
}

function readConfig(cwd: string): PVCConfigFile {
  const configPath = getConfigPath(cwd);
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as PVCConfigFile;
  } catch {
    return {};
  }
}

function getPidPath(cwd: string): string {
  return path.join(getPVCDir(cwd), "watch.pid");
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
  const reportsRootDir = getReportsDir(cwd);
  const sessionReportsDir = path.join(reportsRootDir, sessionId);
  const watchDirPath = path.join(sessionReportsDir, "watch-dir.txt");

  // Check if we have an active watch directory
  if (existsSync(watchDirPath)) {
    const savedDir = readFileSync(watchDirPath, "utf-8").trim();
    if (existsSync(savedDir)) {
      return savedDir;
    }
  }

  // Create new watch directory with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const newWatchDir = path.join(sessionReportsDir, `watch-${timestamp}`);

  if (!existsSync(newWatchDir)) {
    require("fs").mkdirSync(newWatchDir, { recursive: true });
  }

  // Save the watch directory path
  writeFileSync(watchDirPath, newWatchDir, "utf-8");

  return newWatchDir;
}

function clearWatchDir(cwd: string, sessionId: string): void {
  const reportsRootDir = getReportsDir(cwd);
  const sessionReportsDir = path.join(reportsRootDir, sessionId);
  const watchDirPath = path.join(sessionReportsDir, "watch-dir.txt");

  if (existsSync(watchDirPath)) {
    unlinkSync(watchDirPath);
  }
}

function getExistingWatchDir(cwd: string, sessionId: string): string | null {
  const reportsRootDir = getReportsDir(cwd);
  const sessionReportsDir = path.join(reportsRootDir, sessionId);
  const watchDirPath = path.join(sessionReportsDir, "watch-dir.txt");

  if (!existsSync(watchDirPath)) return null;

  const savedDir = readFileSync(watchDirPath, "utf-8").trim();
  return existsSync(savedDir) ? savedDir : null;
}

function getReportFilePaths(cwd: string, sessionId: string): { jsonPath: string; mdPath: string } {
  const watchDir = getWatchDir(cwd, sessionId);

  return {
    jsonPath: path.join(watchDir, "report.json"),
    mdPath: path.join(watchDir, "report.md")
  };
}

async function updateReports(cwd: string, sessionId: string, sessionFile: string) {
  const reportsRootDir = getReportsDir(cwd);
  const sessionReportsDir = path.join(reportsRootDir, sessionId);

  if (!existsSync(sessionReportsDir)) {
    require("fs").mkdirSync(sessionReportsDir, { recursive: true });
  }

  // Parse all events
  const allEvents = parseJSONLFile(sessionFile);

  // Load checkpoint and filter to only NEW events
  const checkpoint = loadCheckpoint(sessionReportsDir);
  let events = allEvents;

  if (checkpoint?.lastTimestamp) {
    const last = new Date(checkpoint.lastTimestamp).getTime();
    events = allEvents.filter(e => {
      if (!e.timestamp) return false;
      return new Date(e.timestamp).getTime() > last;
    });

    if (events.length === 0) {
      console.log("ℹ️  No new events since last checkpoint");
      return;
    }

    console.log(`📊 Found ${events.length} new events (${allEvents.length} total)`);
  } else {
    console.log(`📊 Processing ${events.length} events (first watch run)`);
  }

  // Extract data ONLY from new events
  const userPrompts = extractUserPrompts(events);
  const assistantMessages = extractAssistantMessages(events);
  const fileEdits = extractFileEdits(events);

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
    fileEdits
  };

  const { jsonPath, mdPath } = getReportFilePaths(cwd, sessionId);

  // Generate new content for this update
  const newJsonContent = generateJSONReport(report);
  const newMdContent = generateMarkdownReport(report);

  // APPEND MODE: add new content to existing files
  if (checkpoint?.lastTimestamp) {
    // Append to existing JSON (as new entry in array)
    if (existsSync(jsonPath)) {
      const existingJson = readFileSync(jsonPath, "utf-8");
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
      writeFileSync(jsonPath, JSON.stringify(existingData, null, 2), "utf-8");
    } else {
      writeFileSync(jsonPath, JSON.stringify({ updates: [report] }, null, 2), "utf-8");
    }

    // Append to existing Markdown
    if (existsSync(mdPath)) {
      const existingMd = readFileSync(mdPath, "utf-8");
      const separator = "\n\n---\n\n# 📝 Update at " + nowIso + "\n\n";
      
      // Remove the header from new content (keep only timeline)
      const timelineStart = newMdContent.indexOf("## Session Timeline");
      const timelineContent = timelineStart !== -1 
        ? newMdContent.substring(timelineStart + "## Session Timeline".length).trim()
        : newMdContent;
      
      writeFileSync(mdPath, existingMd + separator + timelineContent, "utf-8");
    } else {
      writeFileSync(mdPath, newMdContent, "utf-8");
    }
  } else {
    // First run: create new files
    writeFileSync(jsonPath, JSON.stringify({ updates: [report] }, null, 2), "utf-8");
    writeFileSync(mdPath, newMdContent, "utf-8");
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
    lastReport: watchDirName
  });

  // Send to backend
  await sendToBackend(cwd, sessionId, jsonPath, mdPath);
}

function createZipArchive(files: string[], cwd: string): Buffer {
  const tempZip = path.join(getPVCDir(cwd), `watch-report-${Date.now()}.zip`);

  if (process.platform === "win32") {
    const ps = spawnSync("powershell", [
      "-NoLogo",
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path ${files.map(f => `"${f}"`).join(",")} -DestinationPath "${tempZip}" -Force`
    ]);
    if (ps.status !== 0) {
      throw new Error(`Compress-Archive failed: ${ps.stderr?.toString() || ps.status}`);
    }
  } else {
    const zip = spawnSync("zip", ["-j", tempZip, ...files]);
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

async function sendToBackend(cwd: string, sessionId: string, jsonPath: string, mdPath: string) {
  const cfg = readConfig(cwd);
  const endpoint = cfg.remote?.url;

  if (!endpoint) {
    console.log("ℹ️ No backend URL configured (remote.url). Skipping upload.");
    return;
  }

  try {
    const zipBuffer = createZipArchive([jsonPath, mdPath], cwd);

    const form = new (globalThis as any).FormData();
    form.append("sessionId", sessionId);
    form.append("cwd", cwd);
    form.append("timestamp", new Date().toISOString());
    form.append(
      "uploadedFile",
      new (globalThis as any).Blob([zipBuffer], { type: "application/zip" }),
      `watch-${sessionId}.zip`
    );

    const response = await fetch("http://localhost:5000/upload", {
      method: "POST",
      body: form
    });

    if (response.ok) {
      console.log("✅ Report uploaded to backend");
    } else {
      console.error(`❌ Backend error ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    console.error("❌ Failed to send to backend:", error);
  }
}

async function runWatchLoop(cwd: string, sessionId: string, intervalMs: number = 3000) {
  const watchDir = getWatchDir(cwd, sessionId);
  const watchDirName = path.basename(watchDir);

  console.log(`👁️  Watching session: ${sessionId}`);
  console.log(`📁 Watch folder: ${watchDirName}`);
  console.log(`⏱️  Checking every ${intervalMs}ms`);
  console.log(`🛑 Stop with: pvc watch stop\n`);

  let lastMtime = 0;
  let notFoundCount = 0;

  while (true) {
    try {
      const sessionFile = findCodexSessionFile(sessionId);

      if (!sessionFile) {
        notFoundCount++;
        if (notFoundCount === 1) {
          console.log("⏳ Waiting for session file to appear...");
        }
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }

      if (notFoundCount > 0) {
        console.log(`✅ Session file found: ${sessionFile}\n`);
        notFoundCount = 0;
      }

      const stat = statSync(sessionFile);

      if (stat.mtimeMs > lastMtime) {
        lastMtime = stat.mtimeMs;
        console.log(`\n🔔 New activity detected at ${new Date().toLocaleTimeString()}`);
        await updateReports(cwd, sessionId, sessionFile);
        console.log("");
      }
    } catch (err) {
      console.error(`❌ Error: ${(err as Error).message}`);
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }
}

function startDaemon(cwd: string, sessionId: string) {
  const isBun = process.execPath.toLowerCase().includes("bun");
  const entry = process.argv[1];
  const args = isBun
    ? [entry, "watch", "--daemon", `--session=${sessionId}`]
    : ["watch", "--daemon", `--session=${sessionId}`];

  const child = spawn(process.execPath, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();
  writeFileSync(getPidPath(cwd), String(child.pid));
  console.log(`✅ Watch daemon started (PID: ${child.pid})`);
}

async function stopDaemon(cwd: string): Promise<void> {
  const pidPath = getPidPath(cwd);
  if (!existsSync(pidPath)) {
    console.log("ℹ️  No watch daemon running");
    return;
  }

  const pid = Number(readFileSync(pidPath, "utf8").trim());

  if (!pid || Number.isNaN(pid)) {
    console.log("⚠️  Invalid PID file, removing...");
    unlinkSync(pidPath);
    return;
  }

  if (!isProcessRunning(pid)) {
    console.log("ℹ️  Watch daemon not running (stale PID)");
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
  const config = readConfig(cwd);
  const sessionId = config.lastSessionId;
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

  if (subcommand === "stop") {
    await stopDaemon(cwd);
    return;
  }

  if (subcommand === "--daemon") {
    const sessionIdArg = args.find(a => a.startsWith("--session="));
    const sessionId = sessionIdArg?.replace("--session=", "") || "";

    if (!sessionId) {
      console.error("❌ No session ID provided to daemon");
      process.exit(1);
    }

    await runWatchLoop(cwd, sessionId);
    return;
  }

  // Start mode
  const pidPath = getPidPath(cwd);
  if (existsSync(pidPath)) {
    const pid = Number(readFileSync(pidPath, "utf8").trim());
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

  startDaemon(cwd, sessionId);
}
