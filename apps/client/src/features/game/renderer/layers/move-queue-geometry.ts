import { RenderConfig } from "#/features/game/renderer/render-config";
import type { MoveIntent } from "#/features/game/utils/move";
import { MoveDirection } from "#/features/game/utils/move";

export interface ArrowTrigonometry {
  cos: number;
  sin: number;
}

export const DIRECTION_TRIGONOMETRY: Record<MoveDirection, ArrowTrigonometry> =
  {
    [MoveDirection.UP]: { cos: 0, sin: -1 },
    [MoveDirection.DOWN]: { cos: 0, sin: 1 },
    [MoveDirection.LEFT]: { cos: -1, sin: 0 },
    [MoveDirection.RIGHT]: { cos: 1, sin: 0 },
  };

export function getArrowAnchor(move: MoveIntent, stride: number) {
  const trigonometry = DIRECTION_TRIGONOMETRY[move.direction];
  const halfLength = RenderConfig.arrowLength / 2;
  const tipInset = RenderConfig.arrowEdgeInset + halfLength;
  let anchorX = move.from.x * stride;
  let anchorY = move.from.y * stride;

  switch (move.direction) {
    case MoveDirection.UP:
      anchorX += stride / 2;
      break;
    case MoveDirection.DOWN:
      anchorX += stride / 2;
      anchorY += stride;
      break;
    case MoveDirection.LEFT:
      anchorY += stride / 2;
      break;
    case MoveDirection.RIGHT:
      anchorX += stride;
      anchorY += stride / 2;
      break;
  }

  return {
    anchorX: anchorX - trigonometry.cos * tipInset,
    anchorY: anchorY - trigonometry.sin * tipInset,
  };
}
