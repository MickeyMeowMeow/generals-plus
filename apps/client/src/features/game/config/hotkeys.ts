import { GridType } from "@generals-plus/engine";

import { MoveDirection } from "#/features/game/utils/move";

export const KeyToDirection: Record<GridType, Record<string, MoveDirection>> = {
  [GridType.SQUARE]: {
    KeyW: MoveDirection.UP,
    KeyA: MoveDirection.LEFT,
    KeyS: MoveDirection.DOWN,
    KeyD: MoveDirection.RIGHT,
    ArrowUp: MoveDirection.UP,
    ArrowLeft: MoveDirection.LEFT,
    ArrowDown: MoveDirection.DOWN,
    ArrowRight: MoveDirection.RIGHT,
  },
  [GridType.HEX]: {
    KeyQ: MoveDirection.TOP_LEFT,
    KeyW: MoveDirection.TOP,
    KeyE: MoveDirection.TOP_RIGHT,
    KeyA: MoveDirection.BOTTOM_LEFT,
    KeyS: MoveDirection.BOTTOM,
    KeyD: MoveDirection.BOTTOM_RIGHT,
  },
} as const;

export const SplitMoveModifier = "Shift";

export const ClearMoveQueueKey = "Space";

export const SurrenderKey = "Escape";

export const KeyToPing: Record<string, "attack" | "defense" | "rally"> = {
  Digit1: "attack",
  Digit2: "defense",
  Digit3: "rally",
};

export const ClearPingBrushKey = "KeyC";
export const ChoosePingBrushModifier = "Shift";

export const ToggleHotkeysKey = "Slash";
export const ToggleHotkeysModifier = "Shift";
