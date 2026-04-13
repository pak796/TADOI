import { themeForObject } from "../app/theme";
import type { WhichKeyHintItem } from "../app/whichKeyHints";

type WhichKeyHintBarProps = {
  items: WhichKeyHintItem[];
  width: number;
};

function formatHintSegment(item: WhichKeyHintItem): string {
  return `${item.key}: ${item.label}`;
}

export function fitHintLine(items: WhichKeyHintItem[], width: number): string {
  const safeWidth = Math.max(8, width);
  let built = "KEYS ";

  for (const item of items) {
    const segment = formatHintSegment(item);
    const candidate =
      built === "KEYS " ? `${built}${segment}` : `${built} · ${segment}`;
    if (candidate.length <= safeWidth) {
      built = candidate;
      continue;
    }
    const withEllipsis = `${built} · ...`;
    if (withEllipsis.length <= safeWidth) {
      return withEllipsis;
    }
    if (built.length > safeWidth) {
      return `${built.slice(0, Math.max(0, safeWidth - 3))}...`;
    }
    return built;
  }

  return built.length <= safeWidth
    ? built
    : `${built.slice(0, Math.max(0, safeWidth - 3))}...`;
}

export function WhichKeyHintBar({ items, width }: WhichKeyHintBarProps) {
  const theme = themeForObject("help");
  if (items.length === 0) return null;

  return (
    <box
      style={{
        flexDirection: "row",
        backgroundColor: theme.panel,
        border: true,
        borderStyle: "single",
        borderColor: theme.outline,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text style={{ color: theme.muted }}>{fitHintLine(items, width)}</text>
    </box>
  );
}
