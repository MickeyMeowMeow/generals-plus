export const ActionType = {
  MOVE: "move",
  SPLIT_MOVE: "split_move",
  CLEAR_QUEUE: "clear_queue",
  SURRENDER: "surrender",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export type MoveActionType =
  | typeof ActionType.MOVE
  | typeof ActionType.SPLIT_MOVE;
