import type { ICoordinate } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { drawCell } from "#/features/game/utils/renderer";

extend({ Graphics });

interface HighlightLayerProps {
  grid: RenderGrid;
  stride: number;
  cellSize: number;
  selection: ICoordinate | null;
}

export function HighlightLayer({
  grid,
  stride,
  cellSize,
  selection,
}: HighlightLayerProps) {
  const drawHighlight = useCallback(
    (g: Graphics) => {
      g.clear();

      // Draw selection highlight
      if (selection) {
        drawCell(g, grid, selection, stride, cellSize);
        g.stroke({ width: 4, color: 0xffffff, alignment: 0 });
      }
    },
    [grid, stride, cellSize, selection],
  );

  return <pixiGraphics draw={drawHighlight} />;
}
