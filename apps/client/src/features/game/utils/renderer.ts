import type { ICoordinate } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";
import type { Graphics } from "pixi.js";

import type { RenderGrid } from "#/features/game/renderer/render-grid";

export function drawCell(
  g: Graphics,
  grid: RenderGrid,
  coord: ICoordinate,
  stride: number,
) {
  const { x, y } = grid.toCartesian(coord);
  if (grid.gridType === GridType.SQUARE) {
    g.rect((x - 0.5) * stride, (y - 0.5) * stride, stride, stride);
  } else if (grid.gridType === GridType.HEX) {
    // TODO: Implement hex drawing logic
  }
}
