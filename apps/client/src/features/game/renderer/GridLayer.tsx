import type { ICoordinate, Terrain } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { useCallback, useMemo } from "react";

import { RenderConfig } from "#features/game/renderer/render-config.ts";
import { TerrainTheme } from "#features/game/renderer/theme.ts";

extend({ Container, Graphics, Sprite });

export interface RenderGridCell {
  coordinate: ICoordinate;
  terrain: Terrain;
}

export interface RenderGrid {
  width: number;
  height: number;

  forEach(callback: (cell: RenderGridCell) => void): void;
}

export interface GridLayout {
  cellSize: number;
  stride: number;
  offsetX: number;
  offsetY: number;
}

interface GridLayerProps {
  grid: RenderGrid;
  stride: number;
}

export function GridLayer({ grid, stride }: GridLayerProps) {
  const cellSize = stride - RenderConfig.cellGap;

  const drawBaseLayer = useCallback(
    (g: Graphics) => {
      g.clear();
      grid.forEach((cell) => {
        const x = cell.coordinate.x * stride;
        const y = cell.coordinate.y * stride;
        const color = TerrainTheme[cell.terrain].color;
        g.rect(x, y, cellSize, cellSize).fill(color);
      });
    },
    [grid, stride, cellSize],
  );

  const iconCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; icon: string }> = [];
    grid.forEach((cell) => {
      const icon = TerrainTheme[cell.terrain].icon;
      if (icon) cells.push({ cell, icon });
    });
    return cells;
  }, [grid]);

  return (
    <pixiContainer>
      <pixiGraphics draw={drawBaseLayer} />
      <pixiContainer>
        {iconCells.map(({ cell, icon }) => {
          const x = cell.coordinate.x * stride + cellSize / 2;
          const y = cell.coordinate.y * stride + cellSize / 2;
          const iconSize = Math.max(
            1,
            cellSize * RenderConfig.terrainIconScale,
          );

          return (
            <pixiSprite
              key={`${cell.coordinate.x},${cell.coordinate.y}`}
              texture={Texture.from(icon)}
              anchor={0.5}
              width={iconSize}
              height={iconSize}
              x={x}
              y={y}
            />
          );
        })}
      </pixiContainer>
    </pixiContainer>
  );
}
