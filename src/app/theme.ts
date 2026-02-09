export const theme = {
  bg: "#0b0f14",
  panel: "#1a202c",
  accentOrange: "#f4a259",
  accentPurple: "#9b59b6",
  accentBlue: "#5dade2",
  ok: "#2ecc71",
  warn: "#e74c3c",
  dueSoon: "#f1c40f",
  dueLater: "#5dade2",
  text: "#f2f2f2",
  muted: "#b0b6bf",
  outline: "#3b4049"
};

export const layout = {
  railWidth: 36,
  rightWidth: 40
};

export const styles = {
  heading: {
    color: theme.text,
    fontWeight: "bold"
  },
  muted: {
    color: theme.muted
  },
  badge: {
    paddingLeft: 1,
    paddingRight: 1,
    backgroundColor: theme.accentOrange,
    color: theme.bg
  },
  button: {
    paddingLeft: 2,
    paddingRight: 2,
    backgroundColor: theme.accentBlue,
    color: theme.bg
  },
  buttonDanger: {
    paddingLeft: 2,
    paddingRight: 2,
    backgroundColor: theme.warn,
    color: theme.bg
  }
};

const tagPalette = [
  "#f4a259",
  "#9b59b6",
  "#5dade2",
  "#2ecc71",
  "#e67e22",
  "#f1c40f",
  "#e84393",
  "#00b894",
  "#e17055",
  "#74b9ff",
  "#55efc4",
  "#fdcb6e",
  "#6c5ce7",
  "#fab1a0",
  "#00cec9",
  "#ffeaa7"
];

export function colorForTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return tagPalette[0];
  const existing = tagColorMap.get(normalized);
  if (existing) return existing;
  const start = hashTag(normalized) % tagPalette.length;
  for (let i = 0; i < tagPalette.length; i += 1) {
    const color = tagPalette[(start + i) % tagPalette.length];
    if (!usedTagColors.has(color)) {
      usedTagColors.add(color);
      tagColorMap.set(normalized, color);
      return color;
    }
  }
  const fallback = tagPalette[start];
  tagColorMap.set(normalized, fallback);
  return fallback;
}

const tagColorMap = new Map<string, string>();
const usedTagColors = new Set<string>();

function hashTag(tag: string): number {
  let hash = 2166136261;
  for (let i = 0; i < tag.length; i += 1) {
    hash ^= tag.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
