export const ItemType = {
  BOMB: 0, // Demolition mode
  RUGBY_BALL: 1, // Rugby mode
  FLAG: 2, // CTF mode
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];
