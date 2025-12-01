#!/usr/bin/env bun
import { initCommand, generateReportCommand } from './commands';
import { watchCommand } from './commands';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs';
import path from 'path';
import { getCodexSessionsRoot } from './utils/path-utils';
import { loginSSHCommand } from './commands/login';
import { pushCommand } from './commands/push';
import { ENV } from './config/env';

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];
const cwd = process.cwd();

function ensurePVC() {
  const pvcDir = path.join(cwd, '.pvc');
  if (!existsSync(pvcDir)) {
    console.error("❌ PVC not initialized. Run 'pvc init' first.");
    process.exit(1);
  }
  return pvcDir;
}

function getConfig(pvcDir: string) {
  const configPath = path.join(pvcDir, 'config.json');
  if (!existsSync(configPath)) {
    console.error('❌ Config file not found.');
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.lastSessionId === undefined) {
    config.lastSessionId = '';
  }
  if (!config.remote) {
    config.remote = { url: '' };
  }
  return config;
}

function saveConfig(pvcDir: string, config: any) {
  const configPath = path.join(pvcDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function main() {
  try {
    switch (command) {
      case 'init':
        initCommand(cwd);
        break;

      case 'update-conv': {
        const pvcDir = ensurePVC();
        const config = getConfig(pvcDir);

        const sessionsRoot = getCodexSessionsRoot();
        if (!sessionsRoot) {
          console.error(
            '❌ Codex sessions directory not found (.codex/sessions).',
          );
          process.exit(1);
        }

        // Recursively find latest .jsonl session file by encoded timestamp (fall back to mtime)
        let latestPath: string | null = null;
        let latestSessionId: string | null = null;
        let latestTimestamp = 0;

        const parseSessionMeta = (fileName: string) => {
          const match = fileName.match(
            /rollout-([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9-]{8})-([0-9a-fA-F-]{36})\.jsonl$/,
          );
          if (!match) return null;

          const [datePart, timePartRaw] = match[1].split('T');
          const timePart = timePartRaw?.replace(/-/g, ':');
          if (!datePart || !timePart) return null;

          const iso = `${datePart}T${timePart}Z`;
          const parsed = Date.parse(iso);
          if (Number.isNaN(parsed)) return null;

          return { ts: parsed, sessionId: match[2] };
        };

        function walk(dir: string) {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
              const stat = statSync(fullPath);
              const meta = parseSessionMeta(entry.name);
              const candidateTs = meta?.ts ?? stat.mtimeMs;

              if (candidateTs > latestTimestamp) {
                latestTimestamp = candidateTs;
                latestPath = fullPath;
                latestSessionId = meta?.sessionId ?? null;
              }
            }
          }
        }

        walk(sessionsRoot);

        if (!latestPath) {
          console.error(
            '❌ No .jsonl session files found in Codex sessions directory.',
          );
          process.exit(1);
        }

        // Prefer sessionId parsed from filename timestamp; fall back to suffix-only parsing
        let lastSessionId = latestSessionId;
        const latestName = path.basename(latestPath);
        if (!lastSessionId) {
          const match = latestName.match(/.*-([0-9a-fA-F-]{36})\.jsonl$/);
          lastSessionId = match ? match[1] : (null as string | null);
        }

        if (!lastSessionId) {
          console.error(
            `❌ Could not extract session_id from file name: ${latestName}`,
          );
          process.exit(1);
        }

        config.lastSessionId = lastSessionId;
        saveConfig(pvcDir, config);

        console.log('✅ Updated lastSessionId in config.json');
        console.log(`🔗 Session ID: ${lastSessionId}`);
        break;
      }

      case 'remote': {
        const pvcDir = ensurePVC();

        if (subcommand === 'add') {
          const url = args[2];
          if (!url) {
            console.error('❌ remote add requires URL');
            console.log('\nUsage: pvc remote add <url>');
            console.log('\nExample:');
            console.log('  pvc remote add https://github.com/user/repo.git');
            process.exit(1);
          }

          try {
            console.log('🔄 Resolving workspace ID...');
            const res = await fetch(
              `${ENV.API_URL}/api/workspaces/resolve-id`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
              },
            );

            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`Failed to resolve workspace ID: ${errorText}`);
            }

            const data = (await res.json()) as {
              id: string;
              username: string;
              workspaceSlug: string;
            };

            const config = getConfig(pvcDir);

            if (!config.remote) {
              config.remote = {};
            }

            config.remote.url = url;
            config.workspaceId = data.id; // Save workspace ID
            saveConfig(pvcDir, config);

            console.log('✅ Remote added');
            console.log(`🔗 URL: ${url}`);
            console.log(`🆔 Workspace ID: ${data.id}`);
            console.log(`👤 Username: ${data.username}`);
            console.log(`slug: ${data.workspaceSlug}`);
          } catch (error) {
            console.error(
              `❌ Error adding remote: ${(error as Error).message}`,
            );
            process.exit(1);
          }
        } else if (subcommand === '-v' || subcommand === 'show') {
          const config = getConfig(pvcDir);

          if (config.remote && config.remote.url) {
            console.log('🔗 Remote URL:');
            console.log(`   ${config.remote.url}`);
          } else {
            console.log('ℹ️ No remote configured');
            console.log('\nTo add a remote, use:');
            console.log('  pvc remote add <url>');
          }
        } else if (subcommand === 'remove' || subcommand === 'rm') {
          const config = getConfig(pvcDir);

          if (config.remote && config.remote.url) {
            const oldUrl = config.remote.url;
            delete config.remote.url;
            if (Object.keys(config.remote).length === 0) {
              delete config.remote;
            }
            saveConfig(pvcDir, config);

            console.log('✅ Remote removed');
            console.log(`🗑️ Removed: ${oldUrl}`);
          } else {
            console.log('ℹ️ No remote configured to remove');
          }
        } else {
          console.error(`❌ Unknown remote subcommand: ${subcommand}`);
          console.log('\nAvailable remote commands:');
          console.log('  pvc remote add <url>    - Add remote repository URL');
          console.log('  pvc remote -v           - Show current remote URL');
          console.log(
            '  pvc remote remove       - Remove remote URL from config',
          );
          process.exit(1);
        }
        break;
      }

      case 'generate': {
        const pvcDir = ensurePVC();
        const config = getConfig(pvcDir);

        const argList = args.slice(1); // after "generate"
        let sessionId: string | null = null;
        let reportName: string | null = null;
        let lastCount: number | null = null;

        for (let i = 0; i < argList.length; i++) {
          const a = argList[i];

          if (a === '-id' || a === '--id') {
            sessionId = argList[i + 1];
            i++;
          } else if (a === '-last' || a === '--last') {
            const possibleNumber = argList[i + 1];
            if (
              possibleNumber &&
              !possibleNumber.startsWith('-') &&
              !isNaN(Number(possibleNumber))
            ) {
              lastCount = Math.max(1, Number(possibleNumber));
              i++;
            } else {
              lastCount = 1;
            }
          } else if (a === '-m' || a === '--message' || a === '--name') {
            reportName = argList[i + 1];
            i++;
          } else if (a === 'report') {
            // Backwards compatibility: ignore old "report" subcommand
            continue;
          } else if (!a.startsWith('-')) {
            // Fallback: support old positional usage generate report <id> <name>
            if (!sessionId) {
              sessionId = a;
            } else if (!reportName) {
              reportName = a;
            }
          }
        }

        if (!sessionId) {
          if (config.lastSessionId) {
            sessionId = config.lastSessionId;
          } else {
            console.error(
              '❌ Error: No session ID provided and config.lastSessionId is empty.',
            );
            console.log('\nOptions:');
            console.log('  - Use last known session:');
            console.log('      pvc update-conv');
            console.log('      pvc generate -m "init report"');
            console.log('  - Or specify session explicitly:');
            console.log('      pvc generate -id <sessionId> -m "report name"');
            process.exit(1);
          }
        }

        if (!reportName) {
          console.error('❌ Error: Missing report name (-m).');
          console.log('\nUsage:');
          console.log('  pvc generate -m "My report"');
          console.log('  pvc generate -id <sessionId> -m "My report"');
          process.exit(1);
        }

        console.log(
          `⚙️ Generating report "${reportName}" for session: ${sessionId}`,
        );

        const result = await generateReportCommand(
          sessionId,
          reportName as string,
          cwd,
          {
            lastCount: lastCount ?? undefined,
          },
        );

        console.log('\n✅ Report generated:');
        console.log(`📄 JSON: ${result.jsonPath}`);
        console.log(`📄 Markdown: ${result.mdPath}`);
        break;
      }

      case 'watch': {
        ensurePVC();
        const sub = args[1];
        if (sub === 'stop') {
          await watchCommand(cwd, ['stop']);
        } else {
          await watchCommand(cwd, args.slice(1));
        }
        break;
      }
      case 'login':
        if (subcommand === '--ssh') {
          const backendUrl = ENV.API_URL;
          await loginSSHCommand(cwd, backendUrl);
        } else {
          console.log('Usage: pvc login --ssh');
        }
        break;

      case 'push':
        await pushCommand(cwd);
        break;

      case 'risk': {
        const sub = args[1];
        const { analyzePromptRealtime, scanFileForSensitiveData } =
          await import('./risk-analysis');

        if (sub === 'scan-prompt') {
          const text = args.slice(2).join(' ');
          const res = analyzePromptRealtime(text, cwd);
          console.log(JSON.stringify(res, null, 2));
        } else if (sub === 'scan-file') {
          const file = args[2];
          if (!file) {
            console.error('Usage: pvc risk scan-file <path>');
            process.exit(1);
          }
          const res = scanFileForSensitiveData(path.resolve(cwd, file), cwd);
          console.log(JSON.stringify(res, null, 2));
        } else {
          console.log('Usage:');
          console.log('  pvc risk scan-prompt "text..."');
          console.log('  pvc risk scan-file path/to/file');
        }
        break;
      }

      default:
        showHelp();
    }
  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`PVC - Prompt Version Control

Usage:
  pvc init                                      Initialize PVC in current directory
  pvc update-conv                               Save last Codex session ID to config
  pvc generate -m "<name>"                      Generate report using lastSessionId
  pvc generate -id <sessionId> -m "<name>"      Generate report for specific session
  pvc generate -last [N] -m "<name>"            Use last N user/assistant messages

  pvc remote add <url>                          Add remote repository URL
  pvc remote -v                                 Show current remote URL
  pvc remote remove                             Remove remote URL from config

  pvc watch                                     Start background watcher (uses lastSessionId)
  pvc watch --session=<id>                      Start watcher for specific session
  pvc watch stop                                Stop running watcher

  pvc login --ssh                               Log in using SSH key challenge/response
  pvc push                                      Upload daily reports to remote backend

Examples:
  pvc init
  pvc update-conv
  pvc generate -m "initial-setup"
  pvc generate -id 019a98c7-eb23-7951-b8e7-30a6b38dceb8 -m "feature-auth"
  pvc remote add https://github.com/user/repo.git
  pvc remote -v
  pvc remote remove
  pvc watch
  pvc login --ssh
  pvc push
`);
}

void main();
