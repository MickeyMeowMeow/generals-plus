import { Visibility } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";
import { drawCell } from "#/features/game/utils/renderer";

extend({ Graphics });

interface GridLayerProps {
  grid: RenderGrid;
  stride: number;
  cellSize: number;
  playerColors: Map<string, number>;
}

function tintColor(color: number, alpha: number): number {
  const r = ((color >> 16) & 0xff) * alpha;
  const g = ((color >> 8) & 0xff) * alpha;
  const b = (color & 0xff) * alpha;
  return (r << 16) | (g << 8) | b;
}

export function GridLayer({
  grid,
  stride,
  cellSize,
  playerColors,
}: GridLayerProps) {
  const drawGrid = useCallback(
    (g: Graphics) => {
      g.clear();
      grid.forEach((cell) => {
        drawCell(g, grid, cell.coordinate, stride, cellSize);

        let color = cell.ownerIndex
          ? (playerColors.get(cell.ownerIndex) ?? 0x333333)
          : TerrainTheme[cell.terrain]?.color || 0xffffff;

        // Handle visibility
        if (cell.visibility === Visibility.HIDDEN) {
          color = 0x000000; // Total black for undiscovered
        } else if (cell.visibility === Visibility.SHROUDED) {
          // Simple way to "tint" for fog: darken the color
          color = tintColor(color, 0.38);
        }

        g.fill(color);
      });
    },
    [grid, stride, cellSize, playerColors],
  );

  return <pixiGraphics draw={drawGrid} />;
}
