import type { ICoordinate } from "@generals-plus/engine";

export const MoveDirection = {
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
} as const;
export type MoveDirection = (typeof MoveDirection)[keyof typeof MoveDirection];

export interface MoveIntent {
  from: ICoordinate;
  direction: MoveDirection;
}

export const KeyToDirection: Record<string, MoveDirection> = {
  w: MoveDirection.UP,
  a: MoveDirection.LEFT,
  s: MoveDirection.DOWN,
  d: MoveDirection.RIGHT,
  arrowup: MoveDirection.UP,
  arrowleft: MoveDirection.LEFT,
  arrowdown: MoveDirection.DOWN,
  arrowright: MoveDirection.RIGHT,
} as const;

export function getTargetCoord(move: MoveIntent): ICoordinate {
  switch (move.direction) {
    case MoveDirection.UP:
      return { x: move.from.x, y: move.from.y - 1 };
    case MoveDirection.DOWN:
      return { x: move.from.x, y: move.from.y + 1 };
    case MoveDirection.LEFT:
      return { x: move.from.x - 1, y: move.from.y };
    case MoveDirection.RIGHT:
      return { x: move.from.x + 1, y: move.from.y };
  }
}
