export const PLAYER_COLOR_PALETTE = [
  0xe74c3c, // Red
  0x3498db, // Blue
  0x2ecc71, // Green
  0xf39c12, // Orange
  0x9b59b6, // Purple
  0x1abc9c, // Teal
  0xe91e63, // Pink
  0x00bcd4, // Cyan
  0xffd54f, // Yellow
  0x7c4dff, // Violet
  0x8bc34a, // Lime
  0x8d6e63, // Brown
  0x546e7a, // Slate
  0x3f51b5, // Indigo
  0xff6f00, // Deep Orange
  0xd500f9, // Magenta
] as const;

export type PlayerColor = (typeof PLAYER_COLOR_PALETTE)[number];

export function isPaletteColor(value: number): value is PlayerColor {
  return (PLAYER_COLOR_PALETTE as readonly number[]).includes(value);
}

export function nextAvailableColor(taken: number[]): PlayerColor | undefined {
  return (PLAYER_COLOR_PALETTE as readonly number[]).find(
    (c) => !taken.includes(c),
  ) as PlayerColor | undefined;
}
