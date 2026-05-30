import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";
import { drawCell } from "#/features/game/utils/renderer";

extend({ Graphics });

interface GridLayerProps {
  tick: number;
  grid: RenderGrid;
  playerColors: Map<string, number>;
}

export function GridLayer({ tick, grid, playerColors }: GridLayerProps) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is intentionally included to force a refresh each tick, since cell ownership changes frequently
  const drawGrid = useCallback(
    (g: Graphics) => {
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

        // Handle collapse warning
        if (cell.willCollapse) {
          drawCell(g, grid, cell.coordinate);
          g.fill({ color: 0x7c3aed, alpha: 0.26 });
          g.stroke({ width: 2, color: 0xd946ef, alignment: 0.5 });
        }
      });
    },
    [tick, grid, playerColors],
  );

  return <pixiGraphics draw={drawGrid} />;
}
