import type { ICoordinate } from "@generals-plus/engine";
import { isSameCoord } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Text, TextStyle } from "pixi.js";
import { useMemo } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderGrid } from "#/features/game/renderer/render-grid";

extend({ Container, Text });

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is intentionally included to force a refresh each tick, since troop counts can change frequently
  const troopCells = useMemo(() => {
    const cells: Array<{ coordinate: ICoordinate; text: string }> = [];

    grid.forEach(({ coordinate, troopCount }) => {
      if (splitMoveSelection && isSameCoord(coordinate, splitMoveSelection)) {
        cells.push({ coordinate, text: "50%" });
      } else if (troopCount) {
        cells.push({ coordinate, text: troopCount.toString() });
      }
    });
    return cells;
  }, [tick, grid, splitMoveSelection]);

  return (
    <pixiContainer>
      {troopCells.map(({ coordinate, text }) => {
        const { x, y } = grid.toCartesian(coordinate);

        return (
          <pixiText
            key={`troop-${coordinate.x},${coordinate.y}`}
            text={text}
            anchor={0.5}
            x={x * RenderConfig.cellStride}
            y={y * RenderConfig.cellStride}
            style={TROOP_TEXT_STYLE}
          />
        );
      })}
    </pixiContainer>
  );
}
