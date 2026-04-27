export const ActionType = {
  MOVE: "move",
  SPLIT_MOVE: "split_move",
  CLEAR_QUEUE: "clear_queue",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];
