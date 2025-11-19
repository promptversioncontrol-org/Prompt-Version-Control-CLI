#!/usr/bin/env bun

import { $ } from "bun";

const platform = process.platform;
const targets = {
  win32: "bun-windows-x64",
  linux: "bun-linux-x64",
  darwin: "bun-darwin-x64"
};

const target = targets[platform as keyof typeof targets] || "bun-windows-x64";
const outfile = platform === "win32" ? "pvc.exe" : "pvc";
const bunPath = process.execPath;

console.log(`🔨 Building for ${platform} (${target})...`);

await $`${bunPath} build ./src/index.ts --compile --target=${target} --outfile=${outfile}`;

console.log(`✔ Build complete: ${outfile}`);

