import type { ICoordinate } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";
import type { Graphics } from "pixi.js";

import type { RenderGrid } from "#/features/game/renderer/render-grid";

export function getCoordWorldPosition(
  coord: ICoordinate,
  stride: number,
  cellSize: number,
) {
  return {
    x: coord.x * stride + cellSize / 2,
    y: coord.y * stride + cellSize / 2,
  };
}

export function drawCell(
  g: Graphics,
  grid: RenderGrid,
  coord: ICoordinate,
  stride: number,
  cellSize: number,
) {
  const { x, y } = grid.toCartesian(coord);
  if (grid.gridType === GridType.SQUARE) {
    g.rect(
      x * stride - cellSize / 2,
      y * stride - cellSize / 2,
      cellSize,
      cellSize,
    );
  } else if (grid.gridType === GridType.HEX) {
    // TODO: Implement hex drawing logic
  }
}
