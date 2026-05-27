import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
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

export function getArrowAnchor(grid: RenderGrid, move: MoveIntent) {
  const trigonometry = DIRECTION_TRIGONOMETRY[move.direction];
  const halfLength = RenderConfig.arrowLength / 2;
  const tipInset = RenderConfig.arrowEdgeInset + halfLength;

  const { x, y } = grid.toCartesian(move.from);
  let anchorX = x * RenderConfig.cellStride;
  let anchorY = y * RenderConfig.cellStride;

  switch (move.direction) {
    case MoveDirection.UP:
      anchorY -= RenderConfig.cellStride / 2;
      break;
    case MoveDirection.DOWN:
      anchorY += RenderConfig.cellStride / 2;
      break;
    case MoveDirection.LEFT:
      anchorX -= RenderConfig.cellStride / 2;
      break;
    case MoveDirection.RIGHT:
      anchorX += RenderConfig.cellStride / 2;
      break;
  }

  return {
    anchorX: anchorX - trigonometry.cos * tipInset,
    anchorY: anchorY - trigonometry.sin * tipInset,
  };
}
