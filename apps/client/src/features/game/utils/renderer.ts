import type { ICoordinate } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";
import type { Graphics } from "pixi.js";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";

export function drawCell(g: Graphics, grid: RenderGrid, coord: ICoordinate) {
  const { x, y } = grid.toCartesian(coord);
  if (grid.gridType === GridType.SQUARE) {
    g.rect(
      (x - 0.5) * RenderConfig.cellStride,
      (y - 0.5) * RenderConfig.cellStride,
      RenderConfig.cellStride,
      RenderConfig.cellStride,
    );
  } else if (grid.gridType === GridType.HEX) {
    // TODO: Implement hex drawing logic
  }
}
