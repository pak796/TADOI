export const MIN_TERMINAL_WIDTH = 104;
export const MIN_TERMINAL_HEIGHT = 24;

export function isTerminalSizeSupported(width: number, height: number): boolean {
  return width >= MIN_TERMINAL_WIDTH && height >= MIN_TERMINAL_HEIGHT;
}

export function getTerminalSizeWarning(width: number, height: number): string {
  return `Terminal too small (min ${MIN_TERMINAL_WIDTH}x${MIN_TERMINAL_HEIGHT}). Current: ${width}x${height}.`;
}
