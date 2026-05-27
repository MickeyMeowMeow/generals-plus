import type { ICoordinate } from "@generals-plus/engine";
import { GridType, isSameCoord } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import type { FederatedPointerEvent } from "pixi.js";
import { Container, Rectangle } from "pixi.js";
import { useCallback, useMemo, useRef } from "react";

import { GridLayer } from "#/features/game/renderer/layers/grid";
import { HighlightLayer } from "#/features/game/renderer/layers/highlight";
import { IconLayer } from "#/features/game/renderer/layers/icon";
import { MoveQueueLayer } from "#/features/game/renderer/layers/move-queue";
import type { Ping } from "#/features/game/renderer/layers/ping";
import { PingLayer } from "#/features/game/renderer/layers/ping";
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
  pings: Ping[];
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
  pings,
}: MapRendererProps) {
  const cellSize = stride - RenderConfig.cellGap;
  const lastPrimaryClickRef = useRef<{
    coord: ICoordinate;
    time: number;
  } | null>(null);

  const hitArea = useMemo(() => {
    switch (grid.gridType) {
      case GridType.SQUARE: {
        return new Rectangle(
          -cellSize / 2,
          -cellSize / 2,
          grid.bounds.width * stride - RenderConfig.cellGap,
          grid.bounds.height * stride - RenderConfig.cellGap,
        );
      }
      case GridType.HEX: {
        return new Rectangle();
      }
    }
  }, [grid.gridType, grid.bounds, stride, cellSize]);

  const onPointerDown = useCallback(
    (e: FederatedPointerEvent) => {
      const localPos = e.currentTarget.toLocal(e.global);
      const coord = grid.fromCartesian({
        x: localPos.x / stride,
        y: localPos.y / stride,
      });
      if (!coord) return;

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
        isSameCoord(lastPrimaryClick.coord, coord) &&
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
    },
    [grid.fromCartesian, stride, onCellClick, onSplitMoveCell],
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
      <MoveQueueLayer grid={grid} stride={stride} moveQueue={moveQueue} />
      <TroopLayer
        grid={grid}
        stride={stride}
        cellSize={cellSize}
        splitMoveSelection={splitMoveSelection}
      />
      <HighlightLayer
        grid={grid}
        stride={stride}
        cellSize={cellSize}
        selection={selection}
      />
      <PingLayer grid={grid} pings={pings} stride={stride} />
    </pixiContainer>
  );
}
