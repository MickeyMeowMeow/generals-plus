import type { ICoordinate } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";
import type { Graphics } from "pixi.js";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";

export function drawCell(g: Graphics, grid: RenderGrid, coord: ICoordinate) {
  const { x, y } = grid.toCartesian(coord);
  switch (grid.gridType) {
    case GridType.SQUARE: {
      g.rect(
        (x - 0.5) * RenderConfig.cellStride,
        (y - 0.5) * RenderConfig.cellStride,
        RenderConfig.cellStride,
        RenderConfig.cellStride,
      );
      break;
    }
    case GridType.HEX: {
      const height = Math.sqrt(3) / 2;
      g.poly([
        {
          x: (x - 0.5) * RenderConfig.cellStride,
          y: (y - height) * RenderConfig.cellStride,
        },
        {
          x: (x + 0.5) * RenderConfig.cellStride,
          y: (y - height) * RenderConfig.cellStride,
        },
        {
          x: (x + 1) * RenderConfig.cellStride,
          y: y * RenderConfig.cellStride,
        },
        {
          x: (x + 0.5) * RenderConfig.cellStride,
          y: (y + height) * RenderConfig.cellStride,
        },
        {
          x: (x - 0.5) * RenderConfig.cellStride,
          y: (y + height) * RenderConfig.cellStride,
        },
        {
          x: (x - 1) * RenderConfig.cellStride,
          y: y * RenderConfig.cellStride,
        },
      ]);
      break;
    }
  }
}
