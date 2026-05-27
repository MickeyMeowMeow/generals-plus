import type { ICoordinate } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { drawCell } from "#/features/game/utils/renderer";

extend({ Graphics });

interface HighlightLayerProps {
  grid: RenderGrid;
  stride: number;
  selection: ICoordinate | null;
}

export function HighlightLayer({
  grid,
  stride,
  selection,
}: HighlightLayerProps) {
  const drawHighlight = useCallback(
    (g: Graphics) => {
      g.clear();

      // Draw selection highlight
      if (selection) {
        drawCell(g, grid, selection, stride);
        g.stroke({
          width: RenderConfig.selectionStroke,
          color: RenderConfig.selectionColor,
          alignment: 0,
        });
      }
    },
    [grid, stride, selection],
  );

  return <pixiGraphics draw={drawHighlight} />;
}
