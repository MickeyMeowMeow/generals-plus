import { ItemType } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";
import { useMemo } from "react";

import { rugbyIcon } from "#/features/game/assets";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";

extend({ Container, Sprite });

interface RugbyBallLayerProps {
  bombMoveSignal: boolean;
  grid: RenderGrid;
}

export function RugbyBallLayer({ bombMoveSignal, grid }: RugbyBallLayerProps) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: bombMoveSignal is intentionally included to force refresh on moves
  const ballCells = useMemo(() => {
    const cells: RenderGridCell[] = [];
    grid.forEach((cell) => {
      if (cell.item && cell.item.type === ItemType.RUGBY_BALL) {
        cells.push(cell);
      }
    });
    return cells;
  }, [bombMoveSignal, grid]);

  const texture = useMemo(() => Texture.from(rugbyIcon), []);

  return (
    <pixiContainer>
      {ballCells.map((cell) => {
        const size = RenderConfig.cellStride * 0.38;

        const cellCoord = grid.toCartesian(cell.coordinate);
        const x = (cellCoord.x + 0.28) * RenderConfig.cellStride;
        const y = (cellCoord.y + 0.28) * RenderConfig.cellStride;
        return (
          <pixiSprite
            key={`rugby-ball-${cell.coordinate.x},${cell.coordinate.y}`}
            texture={texture}
            anchor={0.5}
            x={x}
            y={y}
            width={size}
            height={size}
          />
        );
      })}
    </pixiContainer>
  );
}
