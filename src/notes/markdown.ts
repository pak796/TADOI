function stripInlineFormatting(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "'$1'")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 -> $2")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2 -> $1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .trimEnd();
}

export function renderMarkdownToTerminalLines(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const rendered: string[] = [];
  let inCodeFence = false;

  for (const rawLine of lines) {
    const line = rawLine ?? "";

    if (line.trim().startsWith("```")) {
      inCodeFence = !inCodeFence;
      rendered.push(inCodeFence ? "```" : "```");
      continue;
    }

    if (inCodeFence) {
      rendered.push(`  ${line}`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = stripInlineFormatting(headingMatch[2]);
      const prefix = "#".repeat(level);
      rendered.push(`${prefix} ${content}`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      rendered.push(`| ${stripInlineFormatting(quoteMatch[1])}`);
      continue;
    }

    const listMatch = line.match(/^\s*([-*])\s+(.*)$/);
    if (listMatch) {
      rendered.push(`• ${stripInlineFormatting(listMatch[2])}`);
      continue;
    }

    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      rendered.push(
        `${orderedMatch[1]}. ${stripInlineFormatting(orderedMatch[2])}`,
      );
      continue;
    }

    rendered.push(stripInlineFormatting(line));
  }

  return rendered;
}
