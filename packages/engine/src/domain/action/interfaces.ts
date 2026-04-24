import type { ActionType } from "@/domain/action/action_type";
import type { ICoordinate } from "@/math/coordinate";

export interface IAction {
  readonly playerId: string;
  readonly type: ActionType;
  readonly from: ICoordinate;
  readonly to: ICoordinate;
}
