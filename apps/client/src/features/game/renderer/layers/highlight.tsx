import type { ICoordinate } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

extend({ Graphics });

interface HighlightLayerProps {
  stride: number;
  cellSize: number;
  selection: ICoordinate | null;
}

export function HighlightLayer({
  stride,
  cellSize,
  selection,
}: HighlightLayerProps) {
  const drawHighlight = useCallback(
    (g: Graphics) => {
      g.clear();

      // Draw selection highlight
      if (selection) {
        g.setStrokeStyle({ width: 4, color: 0xffffff, alignment: 0 });
        g.rect(
          selection.x * stride,
          selection.y * stride,
          cellSize,
          cellSize,
        ).stroke();
      }
    },
    [stride, cellSize, selection],
  );

  return <pixiGraphics draw={drawHighlight} />;
}
