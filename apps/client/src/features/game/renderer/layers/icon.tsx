import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";
import { useRef } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";

extend({ Container, Sprite });

interface IconLayerProps {
  grid: RenderGrid;
  terrainRevision: number; // Used to trigger re-computation when terrain icons change
}

export function IconLayer({ grid, terrainRevision }: IconLayerProps) {
  const cacheRef = useRef<{
    revision: number;
    cells: Array<{ cell: RenderGridCell; icon: string }>;
  }>({ revision: -1, cells: [] });

  if (cacheRef.current.revision !== terrainRevision) {
    cacheRef.current.revision = terrainRevision;
    cacheRef.current.cells = [];
    grid.forEach((cell) => {
      const icon = TerrainTheme[cell.terrain]?.icon;
      if (icon) cacheRef.current.cells.push({ cell, icon });
    });
  }

  return (
    <pixiContainer>
      {cacheRef.current.cells.map(({ cell, icon }) => {
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
