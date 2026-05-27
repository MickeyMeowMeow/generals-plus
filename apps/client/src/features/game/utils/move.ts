import type { ICoordinate, MoveActionType } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";

export const MoveDirection = {
  // Square directions
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",

  // Hex directions
  TOP_LEFT: "top-left",
  TOP: "top",
  TOP_RIGHT: "top-right",
  BOTTOM_LEFT: "bottom-left",
  BOTTOM: "bottom",
  BOTTOM_RIGHT: "bottom-right",
} as const;
export type MoveDirection = (typeof MoveDirection)[keyof typeof MoveDirection];

export interface MoveIntent {
  from: ICoordinate;
  direction: MoveDirection;
  type?: MoveActionType;
}

export const KeyToDirection: Record<GridType, Record<string, MoveDirection>> = {
  [GridType.SQUARE]: {
    w: MoveDirection.UP,
    a: MoveDirection.LEFT,
    s: MoveDirection.DOWN,
    d: MoveDirection.RIGHT,
    arrowup: MoveDirection.UP,
    arrowleft: MoveDirection.LEFT,
    arrowdown: MoveDirection.DOWN,
    arrowright: MoveDirection.RIGHT,
  },
  [GridType.HEX]: {
    q: MoveDirection.TOP_LEFT,
    w: MoveDirection.TOP,
    e: MoveDirection.TOP_RIGHT,
    a: MoveDirection.BOTTOM_LEFT,
    s: MoveDirection.BOTTOM,
    d: MoveDirection.BOTTOM_RIGHT,
  },
} as const;

export const ClearMoveQueueKey = " ";

export function getTargetCoord(move: MoveIntent): ICoordinate {
  switch (move.direction) {
    // Square directions
    case MoveDirection.UP:
      return { x: move.from.x, y: move.from.y - 1 };
    case MoveDirection.DOWN:
      return { x: move.from.x, y: move.from.y + 1 };
    case MoveDirection.LEFT:
      return { x: move.from.x - 1, y: move.from.y };
    case MoveDirection.RIGHT:
      return { x: move.from.x + 1, y: move.from.y };

    // Hex directions
    case MoveDirection.TOP_LEFT:
      return { x: move.from.x - 1, y: move.from.y };
    case MoveDirection.TOP:
      return { x: move.from.x, y: move.from.y - 1 };
    case MoveDirection.TOP_RIGHT:
      return { x: move.from.x + 1, y: move.from.y - 1 };
    case MoveDirection.BOTTOM_LEFT:
      return { x: move.from.x - 1, y: move.from.y + 1 };
    case MoveDirection.BOTTOM:
      return { x: move.from.x, y: move.from.y + 1 };
    case MoveDirection.BOTTOM_RIGHT:
      return { x: move.from.x + 1, y: move.from.y };
  }
}
