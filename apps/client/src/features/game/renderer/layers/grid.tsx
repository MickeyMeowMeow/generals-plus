import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";
import { drawCell } from "#/features/game/utils/renderer";

extend({ Graphics });

interface GridLayerProps {
  grid: RenderGrid;
  playerColors: Map<string, number>;
}

export function GridLayer({ grid, playerColors }: GridLayerProps) {
  // Always redraw the entire grid each frame since cell ownership can change frequently
  const drawGrid = (g: Graphics) => {
    g.clear();
    grid.forEach((cell) => {
      drawCell(g, grid, cell.coordinate);
      g.stroke({
        width: RenderConfig.cellStroke,
        color: RenderConfig.background,
      });

      const color = cell.ownerIndex
        ? (playerColors.get(cell.ownerIndex) ?? 0x333333)
        : TerrainTheme[cell.terrain]?.color || 0xffffff;

      g.fill(color);
    });
  };

  return <pixiGraphics draw={drawGrid} />;
}
