#!/usr/bin/env bun
import { initCommand, generateReportCommand } from "./commands";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];
const cwd = process.cwd();

function ensurePVC() {
  const pvcDir = path.join(cwd, ".pvc");
  if (!existsSync(pvcDir)) {
    console.error("❌ PVC not initialized. Run 'pvc init' first.");
    process.exit(1);
  }
  return pvcDir;
}

function getConfig(pvcDir: string) {
  const configPath = path.join(pvcDir, "config.json");
  if (!existsSync(configPath)) {
    console.error("❌ Config file not found.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function saveConfig(pvcDir: string, config: any) {
  const configPath = path.join(pvcDir, "config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function main() {
  try {
    switch (command) {
      case "init":
        initCommand(cwd);
        break;

      case "remote": {
        const pvcDir = ensurePVC();
        
        if (subcommand === "add") {
          const url = args[2];
          if (!url) {
            console.error("❌ remote add requires URL");
            console.log("\nUsage: pvc remote add <url>");
            console.log("\nExample:");
            console.log("  pvc remote add https://github.com/user/repo.git");
            process.exit(1);
          }
          
          const config = getConfig(pvcDir);
          
          // Initialize remote object if it doesn't exist
          if (!config.remote) {
            config.remote = {};
          }
          
          config.remote.url = url;
          saveConfig(pvcDir, config);
          
          console.log("✔ Remote added successfully");
          console.log(`📡 URL: ${url}`);
          
        } else if (subcommand === "-v" || subcommand === "show") {
          const config = getConfig(pvcDir);
          
          if (config.remote && config.remote.url) {
            console.log("📡 Remote URL:");
            console.log(`   ${config.remote.url}`);
          } else {
            console.log("ℹ️  No remote configured");
            console.log("\nTo add a remote, use:");
            console.log("  pvc remote add <url>");
          }
          
        } else if (subcommand === "remove" || subcommand === "rm") {
          const config = getConfig(pvcDir);
          
          if (config.remote && config.remote.url) {
            const oldUrl = config.remote.url;
            delete config.remote.url;
            // Clean up empty remote object
            if (Object.keys(config.remote).length === 0) {
              delete config.remote;
            }
            saveConfig(pvcDir, config);
            
            console.log("✔ Remote removed");
            console.log(`🗑️  Removed: ${oldUrl}`);
          } else {
            console.log("ℹ️  No remote configured to remove");
          }
          
        } else {
          console.error(`❌ Unknown remote subcommand: ${subcommand}`);
          console.log("\nAvailable remote commands:");
          console.log("  pvc remote add <url>    - Add remote repository URL");
          console.log("  pvc remote -v           - Show current remote URL");
          console.log("  pvc remote remove       - Remove remote URL from config");
          process.exit(1);
        }
        break;
      }

      case "generate":
        if (subcommand === "report") {
          const sessionId = args[2];
          const reportName = args[3];
          if (!sessionId || !reportName) {
            console.error("❌ Error: Missing required arguments");
            console.log("\nUsage: pvc generate report <sessionId> <reportName>");
            console.log("\nExample:");
            console.log("  pvc generate report 019a98c7-eb23-7951-b8e7-30a6b38dceb8 initial-setup");
            process.exit(1);
          }
          
          console.log(`🔍 Generating report "${reportName}" for session: ${sessionId}`);
          
          const result = await generateReportCommand(sessionId, reportName, cwd);
          
          console.log("\n✔ Report generated successfully:");
          console.log(`📄 JSON: ${result.jsonPath}`);
          console.log(`📝 Markdown: ${result.mdPath}`);
        } else {
          console.error(`❌ Unknown subcommand: ${subcommand}`);
          showHelp();
        }
        break;

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
  pvc init                                    Initialize PVC in current directory
  pvc generate report <sessionId> <name>      Generate report for a session
  
  pvc remote add <url>                        Add remote repository URL
  pvc remote -v                               Show current remote URL
  pvc remote remove                           Remove remote URL from config

Examples:
  pvc init
  pvc generate report 019a98c7-eb23-7951-b8e7-30a6b38dceb8 initial-setup
  pvc generate report 019a98c7-eb23-7951-b8e7-30a6b38dceb8 feature-auth
  
  pvc remote add https://github.com/user/repo.git
  pvc remote -v
  pvc remote remove
`);
}

main();