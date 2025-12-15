import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../lib/s3-client';
import { getConfigPath, getDailyReportDir } from '../utils/path-utils';
import type { PVCConfig } from '../types';
import { ENV } from '../config/env';

function readConfig(cwd: string): PVCConfig | null {
  const configPath = getConfigPath(cwd);
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as PVCConfig;
  } catch {
    return null;
  }
}

function calculateMD5(filePath: string): string {
  const content = readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function getWorkspaceName(url: string): string | null {
  // Example: http://localhost:3000/Adam903PL/jeden-z-dziesieciu2
  // We want the last part: jeden-z-dziesieciu2
  try {
    const parts = url.split('/').filter(Boolean);
    console.log('parts', parts);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export async function pushCommand(cwd: string): Promise<void> {
  console.log('cwd', cwd);
  console.log('🚀 Starting smart push...');

  const config = readConfig(cwd);
  console.log('config', config);
  if (!config) {
    console.error("❌ Config file not found. Run 'pvc init' first.");
    process.exit(1);
  }

  if (!config.userId) {
    console.error(
      "❌ User ID not found in config. Run 'pvc login --ssh' first.",
    );
    process.exit(1);
  }

  if (!config.remote?.url) {
    console.error(
      "❌ Remote URL not configured. Run 'pvc remote add <url>' first.",
    );
    process.exit(1);
  }

  const workspaceName = getWorkspaceName(config.remote.url);
  if (!workspaceName) {
    console.error(
      `❌ Could not extract workspace name from URL: ${config.remote.url}`,
    );
    process.exit(1);
  }

  const sessionId = config.lastSessionId;
  if (!sessionId) {
    console.error(
      "❌ No active session ID found. Run 'pvc update-conv' first.",
    );
    process.exit(1);
  }

  // Ensure workspaceId is present
  if (!config.workspaceId) {
    console.error(
      "❌ Workspace ID not found in config. Run 'pvc remote add <url>' again to resolve it.",
    );
    process.exit(1);
  }

  const dailyDir = getDailyReportDir(cwd, sessionId);
  if (!existsSync(dailyDir)) {
    console.log('ℹ️  No reports found for today.');
    return;
  }

  const dateStr = path.basename(dailyDir); // e.g., 2025-11-27
  const files = readdirSync(dailyDir).filter((f) => !f.startsWith('.'));
  console.log('files', files);
  if (files.length === 0) {
    console.log('ℹ️  Daily report folder is empty.');
    return;
  }

  console.log(`📂 Scanning folder: ${dateStr}`);
  console.log(`🔗 Workspace ID: ${config.workspaceId}`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(dailyDir, file);
    console.log('filePath', filePath);

    // NEW KEY STRUCTURE: pvc/workspaces/{workspaceId}/{userId}/{date}/{file}
    const fileKey = `pvc/workspaces/${config.workspaceId}/${config.userId}/${dateStr}/${file}`;

    console.log('fileKey', fileKey);
    try {
      const localHash = calculateMD5(filePath);
      console.log('localHash', localHash);
      let shouldUpload = true;

      // Check if file exists on S3
      try {
        const head = await s3Client.send(
          new HeadObjectCommand({
            Bucket: ENV.AWS_BUCKET_NAME, // ✅ Use env var
            Key: fileKey,
          }),
        );

        // ETag is usually MD5 wrapped in quotes, e.g. "d41d8cd98f00b204e9800998ecf8427e"
        const remoteHash = head.ETag?.replace(/"/g, '');

        if (remoteHash === localHash) {
          shouldUpload = false;
        }
      } catch (err: any) {
        if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
          throw err;
        }
        // File doesn't exist, proceed with upload
      }

      if (shouldUpload) {
        process.stdout.write(`⬆️  Uploading ${file}... `);
        const fileContent = readFileSync(filePath);

        await s3Client.send(
          new PutObjectCommand({
            Bucket: ENV.AWS_BUCKET_NAME, // ✅ Use env var
            Key: fileKey,
            Body: fileContent,
            ContentType: file.endsWith('.json')
              ? 'application/json'
              : 'text/markdown',
          }),
        );

        console.log('✅');
        uploaded++;
      } else {
        console.log(`⏭️  Skipped ${file} (unchanged)`);
        skipped++;
      }
    } catch (err: any) {
      console.error(`\n❌ Failed to process ${file}: ${err.message}`);
      console.error('Full error:', JSON.stringify(err, null, 2));
      if (err.stack) console.error(err.stack);
      errors++;
    }
  }

  console.log('\n📊 Push Summary:');
  console.log(`   Uploaded: ${uploaded}`);
  console.log(`   Skipped:  ${skipped}`);
  if (errors > 0) console.log(`   Errors:   ${errors}`);
}
