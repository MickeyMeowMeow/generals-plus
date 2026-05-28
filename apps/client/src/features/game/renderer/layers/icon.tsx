import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";

extend({ Container, Sprite });

interface IconLayerProps {
  grid: RenderGrid;
}

export function IconLayer({ grid }: IconLayerProps) {
  // Always redraw the entire layer each frame since terrain can change frequently (SHROUDED <-> VISIBLE)

  const iconCells: Array<{ cell: RenderGridCell; icon: string }> = [];
  grid.forEach((cell) => {
    const icon = TerrainTheme[cell.terrain]?.icon;
    if (icon) iconCells.push({ cell, icon });
  });

  return (
    <pixiContainer>
      {iconCells.map(({ cell, icon }) => {
        const { x, y } = grid.toCartesian(cell.coordinate);
        const iconSize =
          RenderConfig.cellStride * RenderConfig.terrainIconScale;

        return (
          <pixiSprite
            key={`icon-${cell.coordinate.x},${cell.coordinate.y}`}
            texture={Texture.from(icon)}
            anchor={0.5}
            width={iconSize}
            height={iconSize}
            x={x * RenderConfig.cellStride}
            y={y * RenderConfig.cellStride}
          />
        );
      })}
    </pixiContainer>
  );
}
