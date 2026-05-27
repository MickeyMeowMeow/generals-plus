import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";
import { useMemo } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";

extend({ Container, Sprite });

interface IconLayerProps {
  grid: RenderGrid;
  stride: number;
}

export function IconLayer({ grid, stride }: IconLayerProps) {
  const cellSize = stride - RenderConfig.cellGap;

  const iconCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; icon: string }> = [];
    grid.forEach((cell) => {
      const icon = TerrainTheme[cell.terrain]?.icon;
      if (icon) cells.push({ cell, icon });
    });
    return cells;
    // WARN: Dependency on entire grid, consider restricting to terrain changes
  }, [grid]);

  return (
    <pixiContainer>
      {iconCells.map(({ cell, icon }) => {
        const { x, y } = grid.toCartesian(cell.coordinate);
        const iconSize = Math.max(1, cellSize * RenderConfig.terrainIconScale);

        return (
          <pixiSprite
            key={`icon-${cell.coordinate.x},${cell.coordinate.y}`}
            texture={Texture.from(icon)}
            anchor={0.5}
            width={iconSize}
            height={iconSize}
            x={x * stride}
            y={y * stride}
          />
        );
      })}
    </pixiContainer>
  );
}
