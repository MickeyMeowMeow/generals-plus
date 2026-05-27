import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";
import { useMemo, useState, useEffect } from "react";

import {
  bombNormalIcon,
  bombPlantedIcon,
} from "#/features/game/assets";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";

extend({ Container, Sprite });

interface BombLayerProps {
  grid: RenderGrid;
  stride: number;
  isPlanted: boolean;
}

const bombIcons = {
  normal: bombNormalIcon,
  planted: bombPlantedIcon,
};

export function BombLayer({ grid, stride, isPlanted }: BombLayerProps) {
  const cellSize = stride - RenderConfig.cellGap;

  // Filter cells carrying a C4 bomb (item type 0)
  const bombCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; item: any }> = [];
    grid.forEach((cell) => {
      if (cell.items && cell.items.length > 0) {
        const bomb = cell.items.find((item) => item.type === 0);
        if (bomb) {
          cells.push({ cell, item: bomb });
        }
      }
    });
    return cells;
  }, [grid]);

  // Pulse & flash loop for planted status
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!isPlanted) {
      setFlash(false);
      return;
    }

    const interval = setInterval(() => {
      setFlash((f) => !f);
    }, 500);

    return () => clearInterval(interval);
  }, [isPlanted]);

  return (
    <pixiContainer>
      {bombCells.map(({ cell }) => {
        // Size: 38% of cell size
        const size = cellSize * 0.38;
        // Positioned symmetrically in the bottom-right corner of the cell
        const x = cell.coordinate.x * stride + cellSize * 0.78;
        const y = cell.coordinate.y * stride + cellSize * 0.78;

        const icon = isPlanted
          ? (flash ? bombIcons.planted : bombIcons.normal)
          : bombIcons.normal;
        const texture = Texture.from(icon);
        const finalSize = isPlanted && flash ? size * 1.15 : size;
        const finalAlpha = isPlanted && flash ? 0.6 : 1.0;

        return (
          <pixiSprite
            key={`bomb-${cell.coordinate.x},${cell.coordinate.y}`}
            texture={texture}
            anchor={0.5}
            x={x}
            y={y}
            width={finalSize}
            height={finalSize}
            alpha={finalAlpha}
          />
        );
      })}
    </pixiContainer>
  );
}


