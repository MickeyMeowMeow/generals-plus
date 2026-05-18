import type { ICoordinate } from "@generals-plus/engine";
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
  splitMoveSelection: ICoordinate | null;
}

function isSameCoord(a: ICoordinate, b: ICoordinate | null): boolean {
  return !!b && a.x === b.x && a.y === b.y;
}

export function TroopLayer({
  grid,
  stride,
  cellSize,
  splitMoveSelection,
}: TroopLayerProps) {
  const troopCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; text: string }> = [];
    grid.forEach((cell) => {
      const isSplitMoveCell = isSameCoord(cell.coordinate, splitMoveSelection);
      if (cell.troopCount || isSplitMoveCell) {
        cells.push({
          cell,
          text: isSplitMoveCell ? "50%" : cell.troopCount!.toString(),
        });
      }
    });
    return cells;
  }, [grid, splitMoveSelection]);

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
      {troopCells.map(({ cell, text }) => {
        const x = cell.coordinate.x * stride + cellSize / 2;
        const y = cell.coordinate.y * stride + cellSize / 2;

        return (
          <pixiText
            key={`troop-${cell.coordinate.x},${cell.coordinate.y}`}
            text={text}
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
