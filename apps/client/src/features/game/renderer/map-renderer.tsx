import type { ICoordinate } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import type { FederatedPointerEvent } from "pixi.js";
import { Container, Rectangle } from "pixi.js";
import { useCallback, useMemo } from "react";

import { GridLayer } from "#/features/game/renderer/layers/grid";
import { HighlightLayer } from "#/features/game/renderer/layers/highlight";
import { IconLayer } from "#/features/game/renderer/layers/icon";
import { MoveQueueLayer } from "#/features/game/renderer/layers/move-queue";
import { TroopLayer } from "#/features/game/renderer/layers/troop";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import type { MoveIntent } from "#/features/game/utils/move";

extend({ Container });

interface MapRendererProps {
  grid: RenderGrid;
  stride: number;
  selection: ICoordinate | null;
  moveQueue: MoveIntent[];
  onCellClick: (coordinate: ICoordinate) => void;
  playerColors: Map<string, number>;
}

export function MapRenderer({
  grid,
  stride,
  selection,
  moveQueue,
  onCellClick,
  playerColors,
}: MapRendererProps) {
  const cellSize = stride - RenderConfig.cellGap;
  const hitArea = useMemo(
    () =>
      new Rectangle(
        0,
        0,
        grid.width * stride - RenderConfig.cellGap,
        grid.height * stride - RenderConfig.cellGap,
      ),
    [grid.width, grid.height, stride],
  );

  const onPointerDown = useCallback(
    (e: FederatedPointerEvent) => {
      const localPos = e.currentTarget.toLocal(e.global);
      const x = Math.floor(localPos.x / stride);
      const y = Math.floor(localPos.y / stride);
      if (x >= 0 && x < grid.width && y >= 0 && y < grid.height) {
        onCellClick({ x, y });
      }
    },
    [grid.width, grid.height, stride, onCellClick],
  );

  return (
    <pixiContainer
      eventMode="static"
      hitArea={hitArea}
      onPointerDown={onPointerDown}
    >
      <GridLayer
        grid={grid}
        stride={stride}
        cellSize={cellSize}
        playerColors={playerColors}
      />
      <IconLayer grid={grid} stride={stride} />
      <TroopLayer grid={grid} stride={stride} cellSize={cellSize} />
      <HighlightLayer
        stride={stride}
        cellSize={cellSize}
        selection={selection}
      />
      <MoveQueueLayer stride={stride} moveQueue={moveQueue} />
    </pixiContainer>
  );
}
