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
import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import type { MoveIntent } from "#/features/game/utils/move";

extend({ Container });

interface MapRendererProps {
  grid: RenderGrid;
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
  selection,
  splitMoveSelection,
  moveQueue,
  onCellClick,
  onSplitMoveCell,
  playerColors,
  pings,
}: MapRendererProps) {
  const lastPrimaryClickRef = useRef<{
    coord: ICoordinate;
    time: number;
  } | null>(null);

  const hitArea = useMemo(() => {
    switch (grid.gridType) {
      case GridType.SQUARE: {
        return new Rectangle(
          -RenderConfig.cellStride / 2,
          -RenderConfig.cellStride / 2,
          grid.bounds.width * RenderConfig.cellStride,
          grid.bounds.height * RenderConfig.cellStride,
        );
      }
      case GridType.HEX: {
        return new Rectangle();
      }
    }
  }, [grid.gridType, grid.bounds]);

  const onPointerDown = useCallback(
    (e: FederatedPointerEvent) => {
      const localPos = e.currentTarget.toLocal(e.global);
      const coord = grid.fromCartesian({
        x: localPos.x / RenderConfig.cellStride,
        y: localPos.y / RenderConfig.cellStride,
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
    [grid.fromCartesian, onCellClick, onSplitMoveCell],
  );

  return (
    <pixiContainer
      eventMode="static"
      hitArea={hitArea}
      onPointerDown={onPointerDown}
    >
      <GridLayer grid={grid} playerColors={playerColors} />
      <IconLayer grid={grid} />
      <MoveQueueLayer grid={grid} moveQueue={moveQueue} />
      <TroopLayer grid={grid} splitMoveSelection={splitMoveSelection} />
      <HighlightLayer grid={grid} selection={selection} />
      <PingLayer grid={grid} pings={pings} />
    </pixiContainer>
  );
}
