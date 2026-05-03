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
  stride: number;
  cellSize: number;
}

export function TroopLayer({ grid, stride, cellSize }: TroopLayerProps) {
  const troopCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; count: number }> = [];
    grid.forEach((cell) => {
      if (cell.troopCount) {
        cells.push({ cell, count: cell.troopCount });
      }
    });
    return cells;
  }, [grid]);

  const troopTextStyle = useMemo(() => {
    return new TextStyle({
      fontFamily: RenderConfig.troopTextFontFamily,
      fontSize: cellSize * RenderConfig.troopTextFontSizeRatio,
      fontWeight: RenderConfig.troopTextFontWeight,
      fill: RenderConfig.troopTextColor,
      stroke: {
        color: RenderConfig.troopTextStrokeColor,
        width: RenderConfig.troopTextStrokeWidth,
      },
    });
  }, [cellSize]);

  return (
    <pixiContainer>
      {troopCells.map(({ cell, count }) => {
        const x = cell.coordinate.x * stride + cellSize / 2;
        const y = cell.coordinate.y * stride + cellSize / 2;

        return (
          <pixiText
            key={`troop-${cell.coordinate.x},${cell.coordinate.y}`}
            text={count.toString()}
            anchor={0.5}
            x={x}
            y={y}
            style={troopTextStyle}
          />
        );
      })}
    </pixiContainer>
  );
}
