export const ActionType = {
  MOVE: "move",
  SPLIT_MOVE: "split_move",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];
