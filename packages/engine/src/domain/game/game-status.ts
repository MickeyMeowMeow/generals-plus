/**
 * Represents the current state of a match lifecycle.
 */
export const GameStatus = {
  /** The game is currently active and ongoing. */
  PLAYING: "playing",

  /** The game has concluded and the results are final. */
  FINISHED: "finished",
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];
