export function createSimpleDiff(oldLines: string[], newLines: string[]): string {
  let diff = "";
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      diff += "  " + (oldLine || "") + "\n";
    } else {
      if (oldLine !== undefined) {
        diff += "- " + oldLine + "\n";
      }
      if (newLine !== undefined) {
        diff += "+ " + newLine + "\n";
      }
    }
  }

  return diff;
}

