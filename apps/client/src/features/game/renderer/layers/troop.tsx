import type { ICoordinate } from "@generals-plus/engine";
import { isSameCoord } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Text, TextStyle } from "pixi.js";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderGrid } from "#/features/game/renderer/render-grid";

extend({ Container, Text });

interface TroopLayerProps {
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

export function TroopLayer({ grid, splitMoveSelection }: TroopLayerProps) {
  const troopCells: Array<{ coordinate: ICoordinate; text: string }> = [];

  // Always re-compute troop cells since troop counts change almost every tick
  grid.forEach(({ coordinate, troopCount }) => {
    const isSplitMoveCell =
      splitMoveSelection && isSameCoord(coordinate, splitMoveSelection);

    if (troopCount || isSplitMoveCell) {
      troopCells.push({
        coordinate,
        text: isSplitMoveCell ? "50%" : (troopCount ?? "").toString(),
      });
    }
  });

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
