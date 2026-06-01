import type { ICoordinate } from "@generals-plus/engine";
import { isSameCoord } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Text, TextStyle } from "pixi.js";
import { useEffect, useRef } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";

extend({ Container });

interface TroopLayerProps {
  tick: number;
  grid: RenderGrid;
  splitMoveSelection: ICoordinate | null;
}

const TROOP_TEXT_STYLE = new TextStyle({
  fontFamily: RenderConfig.troopTextFontFamily,
  fontSize: RenderConfig.cellStride * RenderConfig.troopTextFontSizeRatio,
  fontWeight: RenderConfig.troopTextFontWeight,
  fill: RenderConfig.troopTextColor,
  stroke: {
    color: RenderConfig.troopTextStrokeColor,
    width: RenderConfig.troopTextStrokeWidth,
  },
  dropShadow: {
    color: RenderConfig.troopTextShadowColor,
    alpha: RenderConfig.troopTextShadowAlpha,
    blur: RenderConfig.troopTextShadowBlur,
    distance: RenderConfig.troopTextShadowDistance,
    angle: RenderConfig.troopTextShadowAngle,
  },
});

export function TroopLayer({
  tick,
  grid,
  splitMoveSelection,
}: TroopLayerProps) {
  const containerRef = useRef<Container>(null);
  const poolRef = useRef<Map<string, { textObj: Text; text: string }>>(
    new Map(),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is intentionally included to force a refresh each tick, since troop counts can change frequently
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pool = poolRef.current;

    grid.forEach(({ coordinate, troopCount }) => {
      const isSplitMove =
        splitMoveSelection && isSameCoord(coordinate, splitMoveSelection);

      const textValue = isSplitMove
        ? "50%"
        : troopCount
          ? troopCount.toString()
          : null;

      const key = `${coordinate.x},${coordinate.y}`;
      const entry = pool.get(key);

      if (!textValue) {
        if (entry) {
          // Clean up for removed troop text
          container.removeChild(entry.textObj);
          entry.textObj.destroy();
          pool.delete(key);
        }
        return;
      }

      if (!entry) {
        const textObj = new Text({ text: textValue, style: TROOP_TEXT_STYLE });
        const { x, y } = grid.toCartesian(coordinate);

        textObj.anchor.set(0.5);
        textObj.x = x * RenderConfig.cellStride;
        textObj.y = y * RenderConfig.cellStride;

        container.addChild(textObj);
        pool.set(key, { textObj, text: textValue });
      }
      // Update text string only if it changed
      else if (entry.text !== textValue) {
        entry.textObj.text = textValue;
        entry.text = textValue;
      }
    });
  }, [tick, grid, splitMoveSelection]);

  return <pixiContainer ref={containerRef} />;
}
