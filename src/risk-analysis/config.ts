import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { getPVCDir } from '../utils/path-utils';

export interface FileSensitivityConfig {
  folderPatterns: RegExp[];
  filePatterns: RegExp[];
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
  const sensitiveDir = path.join(pvcDir, 'sensitive');

  const foldersFile = path.join(sensitiveDir, 'folders.rules');
  const commonFile = path.join(sensitiveDir, 'files.common.rules');
  const customFile = path.join(sensitiveDir, 'files.custom.rules');

  const folderLines = loadLines(foldersFile);
  const fileLines = [...loadLines(commonFile), ...loadLines(customFile)];

  const folderPatterns = folderLines.map(globToRegex);
  const filePatterns = fileLines.map(globToRegex);

  return { folderPatterns, filePatterns };
}
