export const PlayerStatus = {
  /** Player is still active in the match. */
  ACTIVE: "active",
  /** Player has been defeated and can no longer take gameplay actions. */
  ELIMINATED: "eliminated",
  /** Player is observing the match but not participating. */
  SPECTATING: "spectating",
} as const;

export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];
