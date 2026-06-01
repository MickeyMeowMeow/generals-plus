import type { ICoordinate } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

import { getBoardPulse } from "#/features/game/renderer/board-motion";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { drawCell } from "#/features/game/utils/renderer";
import { useMotionPreference } from "#/features/motion/motion-provider";

extend({ Graphics });

interface HighlightLayerProps {
  grid: RenderGrid;
  selection: ICoordinate | null;
}

export function HighlightLayer({ grid, selection }: HighlightLayerProps) {
  const { shouldReduceMotion } = useMotionPreference();

  // Only redraw when selection changes
  const drawHighlight = useCallback(
    (g: Graphics) => {
      g.clear();

      // Draw selection highlight
      if (selection) {
        const pulse = getBoardPulse({
          ageMs: 0,
          reducedMotion: shouldReduceMotion,
        });
        drawCell(g, grid, selection);
        g.stroke({
          width: RenderConfig.selectionStroke * pulse.scale,
          color: RenderConfig.selectionColor,
          alpha: pulse.alpha,
        });
      }
    },
    [grid, selection, shouldReduceMotion],
  );

  return <pixiGraphics draw={drawHighlight} />;
}
