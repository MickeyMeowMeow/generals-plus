import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";
import { useEffect, useMemo, useState } from "react";

import { bombNormalIcon, bombPlantedIcon } from "#/features/game/assets";
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
  /** Ticks remaining until detonation. -1 if unknown or not applicable. */
  ticksRemaining?: number;
}

const bombIcons = {
  normal: bombNormalIcon,
  planted: bombPlantedIcon,
};

function computeFlashInterval(ticksRemaining: number | undefined): number {
  if (ticksRemaining === undefined || ticksRemaining < 0) return 500;
  if (ticksRemaining <= 20) return 100;
  if (ticksRemaining <= 40) return 200;
  if (ticksRemaining <= 60) return 300;
  return 500;
}

export function BombLayer({
  grid,
  stride,
  isPlanted,
  ticksRemaining = -1,
}: BombLayerProps) {
  const cellSize = stride - RenderConfig.cellGap;

  const bombCells = useMemo(() => {
    const cells: Array<{
      cell: RenderGridCell;
      item: NonNullable<RenderGridCell["items"]>[number];
    }> = [];
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

  const [flash, setFlash] = useState(false);

  const ms = isPlanted ? computeFlashInterval(ticksRemaining) : 0;

  useEffect(() => {
    if (!isPlanted) {
      setFlash(false);
      return;
    }

    const id = setInterval(() => {
      setFlash((f) => !f);
    }, ms);

    return () => clearInterval(id);
  }, [isPlanted, ms]);

  return (
    <pixiContainer>
      {bombCells.map(({ cell }) => {
        const size = cellSize * 0.38;
        const x = cell.coordinate.x * stride + cellSize * 0.78;
        const y = cell.coordinate.y * stride + cellSize * 0.78;

        const icon = isPlanted
          ? flash
            ? bombIcons.planted
            : bombIcons.normal
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
