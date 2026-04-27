import type { ActionType, MoveActionType } from "#/domain/action/action-type";
import type { ICoordinate } from "#/math/coordinate";

/**
 * Represents a player-initiated action in the game.
 */
export interface BaseAction {
  readonly playerId: string;
  readonly type: ActionType;
}

/**
 * Represents a movement action where a player moves troops from one cell to another.
 */
export interface MoveAction extends BaseAction {
  readonly type: MoveActionType;
  readonly from: ICoordinate;
  readonly to: ICoordinate;
}

/**
 * Represents an action to clear the player's action queue.
 */
export interface ClearQueueAction extends BaseAction {
  readonly type: typeof ActionType.CLEAR_QUEUE;
}

/**
 * Represents an action where a player surrenders.
 */
export interface SurrenderAction extends BaseAction {
  readonly type: typeof ActionType.SURRENDER;
}

export type Action = MoveAction | ClearQueueAction | SurrenderAction;
