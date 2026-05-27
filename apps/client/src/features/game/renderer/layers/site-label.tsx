import { Terrain } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Text, TextStyle } from "pixi.js";
import { useMemo } from "react";

import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";
import { getCoordWorldPosition } from "#/features/game/utils/coord";

extend({ Container, Text });

interface SiteLabelLayerProps {
  grid: RenderGrid;
  stride: number;
  cellSize: number;
}

export function SiteLabelLayer({
  grid,
  stride,
  cellSize,
}: SiteLabelLayerProps) {
  const siteCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; label: string }> = [];
    grid.forEach((cell) => {
      if (
        cell.terrain === Terrain.BOMB_SITE &&
        cell.siteIndex !== null &&
        cell.siteIndex !== undefined &&
        cell.siteIndex >= 0
      ) {
        cells.push({
          cell,
          label: String.fromCharCode(65 + cell.siteIndex),
        });
      }
    });
    return cells;
  }, [grid]);

  const siteTextStyle = useMemo(() => {
    return new TextStyle({
      fontFamily: "Oxanium Variable, sans-serif",
      fontSize: cellSize * 0.48,
      fontWeight: "900",
      fill: 0xffffff,
      stroke: {
        color: 0x111111,
        width: 6,
      },
    });
  }, [cellSize]);

  return (
    <pixiContainer>
      {siteCells.map(({ cell, label }) => {
        const { x, y } = getCoordWorldPosition(
          cell.coordinate,
          stride,
          cellSize,
        );

        return (
          <pixiText
            key={`site-label-${cell.coordinate.x},${cell.coordinate.y}`}
            text={label}
            anchor={0.5}
            x={x}
            y={y}
            style={siteTextStyle}
          />
        );
      })}
    </pixiContainer>
  );
}
