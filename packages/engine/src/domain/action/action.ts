import type { ICoordinate } from "@/math/coordinate";

export const ActionType = {
  MOVE: "move",
  SPLIT_MOVE: "split_move",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export interface IAction {
  readonly playerId: string;
  readonly type: ActionType;
  readonly from: ICoordinate;
  readonly to: ICoordinate;
}
