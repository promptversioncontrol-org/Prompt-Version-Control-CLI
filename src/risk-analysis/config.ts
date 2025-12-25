import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { getPVCDir } from '../utils/path-utils.js';

export interface FileSensitivityConfig {
  patterns: RegExp[];
}

function loadLines(filePath: string): string[] {
  if (!existsSync(filePath)) {
    return [];
  }
  const lines = readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  return lines;
}

function globToRegex(pattern: string): RegExp {
  const originalPattern = pattern.trim();

  // Escape special regex characters EXCEPT *
  let regex = originalPattern
    .replace(/\\/g, '\\\\')
    .replace(/\./g, '\\.')
    .replace(/\+/g, '\\+')
    .replace(/\?/g, '.')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\|/g, '\\|')
    .replace(/\^/g, '\\^')
    .replace(/\$/g, '\\$');

  // Replace * with .* (any characters)
  regex = regex.replace(/\*/g, '.*');

  // Add anchors based on original pattern
  if (!originalPattern.startsWith('*')) {
    regex = '^' + regex;
  }

  if (!originalPattern.endsWith('*')) {
    regex = regex + '$';
  }

  return new RegExp(regex, 'i');
}

export function loadFileSensitivityConfig(cwd: string): FileSensitivityConfig {
  const pvcDir = getPVCDir(cwd);
  const rulesDir = path.join(pvcDir, 'rules');
  const rulesFile = path.join(rulesDir, 'pvc.rules');

  const lines = loadLines(rulesFile);
  const patterns = lines.map(globToRegex);

  return { patterns };
}
