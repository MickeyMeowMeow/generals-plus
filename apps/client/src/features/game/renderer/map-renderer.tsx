import type { ICoordinate } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import type { FederatedPointerEvent } from "pixi.js";
import { Container, Rectangle } from "pixi.js";
import { useCallback, useMemo, useRef } from "react";

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
  splitMoveSelection: ICoordinate | null;
  moveQueue: MoveIntent[];
  onCellClick: (coordinate: ICoordinate) => void;
  onSplitMoveCell: (coordinate: ICoordinate) => void;
  playerColors: Map<string, number>;
}

export function MapRenderer({
  grid,
  stride,
  selection,
  splitMoveSelection,
  moveQueue,
  onCellClick,
  onSplitMoveCell,
  playerColors,
}: MapRendererProps) {
  const cellSize = stride - RenderConfig.cellGap;
  const lastPrimaryClickRef = useRef<{
    coord: ICoordinate;
    time: number;
  } | null>(null);
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
        const coord = { x, y };
        if (e.button === 2) {
          onSplitMoveCell(coord);
          lastPrimaryClickRef.current = null;
          return;
        }

        const now = performance.now();
        const lastPrimaryClick = lastPrimaryClickRef.current;
        const isDoubleClick =
          e.button === 0 &&
          lastPrimaryClick !== null &&
          lastPrimaryClick.coord.x === x &&
          lastPrimaryClick.coord.y === y &&
          now - lastPrimaryClick.time <= 300;

        if (isDoubleClick) {
          onSplitMoveCell(coord);
          lastPrimaryClickRef.current = null;
          return;
        }

        onCellClick(coord);
        if (e.button === 0) {
          lastPrimaryClickRef.current = { coord, time: now };
        }
      }
    },
    [grid.width, grid.height, stride, onCellClick, onSplitMoveCell],
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
      <MoveQueueLayer stride={stride} moveQueue={moveQueue} />
      <TroopLayer
        grid={grid}
        stride={stride}
        cellSize={cellSize}
        splitMoveSelection={splitMoveSelection}
      />
      <HighlightLayer
        stride={stride}
        cellSize={cellSize}
        selection={selection}
      />
    </pixiContainer>
  );
}
