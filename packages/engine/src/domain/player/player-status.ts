export const PlayerStatus = {
  /** Player is still active in the match. */
  ACTIVE: "active",
  /** Player has been defeated and can no longer take gameplay actions. */
  ELIMINATED: "eliminated",
} as const;

export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];
