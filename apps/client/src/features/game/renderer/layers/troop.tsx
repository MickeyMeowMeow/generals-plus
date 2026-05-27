import type { ICoordinate } from "@generals-plus/engine";
import { isSameCoord } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Text, TextStyle } from "pixi.js";
import { useMemo } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";

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
  const troopCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; text: string }> = [];
    grid.forEach((cell) => {
      const isSplitMoveCell =
        splitMoveSelection && isSameCoord(cell.coordinate, splitMoveSelection);
      if (cell.troopCount || isSplitMoveCell) {
        cells.push({
          cell,
          text: isSplitMoveCell ? "50%" : (cell.troopCount ?? "").toString(),
        });
      }
    });
    return cells;
  }, [grid, splitMoveSelection]);

  return (
    <pixiContainer>
      {troopCells.map(({ cell, text }) => {
        const { x, y } = grid.toCartesian(cell.coordinate);

        return (
          <pixiText
            key={`troop-${cell.coordinate.x},${cell.coordinate.y}`}
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
