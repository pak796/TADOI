function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function centerLogoInBox(
  lines: string[],
  boxWidth: number,
  boxHeight: number
): string[] {
  const safeWidth = Math.max(0, Math.floor(boxWidth));
  const safeHeight = Math.max(0, Math.floor(boxHeight));
  const blankLine = " ".repeat(safeWidth);
  const out = Array.from({ length: safeHeight }, () => blankLine);

  if (safeWidth === 0 || safeHeight === 0) {
    return out;
  }

  let firstNonEmpty = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/\S/.test(lines[i] ?? "")) {
      firstNonEmpty = i;
      break;
    }
  }

  if (firstNonEmpty === -1) {
    return out;
  }

  let lastNonEmpty = firstNonEmpty;
  for (let i = lines.length - 1; i >= firstNonEmpty; i -= 1) {
    if (/\S/.test(lines[i] ?? "")) {
      lastNonEmpty = i;
      break;
    }
  }

  const contentLines = lines.slice(firstNonEmpty, lastNonEmpty + 1);
  const contentWidth = contentLines.reduce(
    (maxWidth, line) => Math.max(maxWidth, line.length),
    0
  );

  const leftPad = clamp(Math.floor((safeWidth - contentWidth) / 2), 0, safeWidth);
  const topPad = clamp(
    Math.floor((safeHeight - contentLines.length) / 2),
    0,
    safeHeight
  );

  for (let i = 0; i < contentLines.length; i += 1) {
    const targetRow = topPad + i;
    if (targetRow < 0 || targetRow >= safeHeight) continue;
    let centeredLine = `${" ".repeat(leftPad)}${contentLines[i]}`;
    if (centeredLine.length > safeWidth) {
      centeredLine = centeredLine.slice(0, safeWidth);
    }
    if (centeredLine.length < safeWidth) {
      centeredLine = centeredLine.padEnd(safeWidth, " ");
    }
    out[targetRow] = centeredLine;
  }

  return out;
}

