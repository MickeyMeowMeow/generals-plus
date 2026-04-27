export const MatchMessage = {
  ACTION: "action",
  CLEAR_QUEUE: "clear_queue",
  GAME_END: "game_end",
} as const;

export type MatchMessageType = (typeof MatchMessage)[keyof typeof MatchMessage];
