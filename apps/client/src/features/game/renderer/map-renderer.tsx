import type { ICoordinate } from "@generals-plus/engine";
import { isSameCoord } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import type { FederatedPointerEvent } from "pixi.js";
import { Container, Rectangle } from "pixi.js";
import { useCallback, useMemo, useRef } from "react";

import { BombLayer } from "#/features/game/renderer/layers/bomb";
import { GridLayer } from "#/features/game/renderer/layers/grid";
import { HighlightLayer } from "#/features/game/renderer/layers/highlight";
import { IconLayer } from "#/features/game/renderer/layers/icon";
import { MoveQueueLayer } from "#/features/game/renderer/layers/move-queue";
import type { Ping } from "#/features/game/renderer/layers/ping";
import { PingLayer } from "#/features/game/renderer/layers/ping";
import { SiteLabelLayer } from "#/features/game/renderer/layers/site-label";
import { TroopLayer } from "#/features/game/renderer/layers/troop";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import type { MoveIntent } from "#/features/game/utils/move";

extend({ Container });

interface MapRendererProps {
  tick: number;
  worldBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  grid: RenderGrid;
  selection: ICoordinate | null;
  splitMoveSelection: ICoordinate | null;
  moveQueue: MoveIntent[];
  bombMoveSignal: boolean;
  onCellClick: (coordinate: ICoordinate) => void;
  onSplitMoveCell: (coordinate: ICoordinate) => void;
  playerColors: Map<string, number>;
  pings: Ping[];
  isPlanted?: boolean;
  ticksRemaining?: number;
}

export function MapRenderer({
  tick,
  worldBounds,
  grid,
  selection,
  splitMoveSelection,
  moveQueue,
  bombMoveSignal,
  onCellClick,
  onSplitMoveCell,
  playerColors,
  pings,
  isPlanted = false,
  ticksRemaining = -1,
}: MapRendererProps) {
  const lastPrimaryClickRef = useRef<{
    coord: ICoordinate;
    time: number;
  } | null>(null);

  const hitArea = useMemo(
    () =>
      new Rectangle(
        worldBounds.left,
        worldBounds.top,
        worldBounds.right - worldBounds.left,
        worldBounds.bottom - worldBounds.top,
      ),
    [worldBounds],
  );

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
    [grid, onCellClick, onSplitMoveCell],
  );

  return (
    <pixiContainer
      eventMode="static"
      hitArea={hitArea}
      onPointerDown={onPointerDown}
    >
      <GridLayer tick={tick} grid={grid} playerColors={playerColors} />
      <IconLayer tick={tick} grid={grid} />
      <SiteLabelLayer grid={grid} />
      <MoveQueueLayer grid={grid} moveQueue={moveQueue} />
      <TroopLayer
        tick={tick}
        grid={grid}
        splitMoveSelection={splitMoveSelection}
      />
      <BombLayer
        bombMoveSignal={bombMoveSignal}
        grid={grid}
        isPlanted={isPlanted}
        ticksRemaining={ticksRemaining}
      />
      <HighlightLayer grid={grid} selection={selection} />
      <PingLayer grid={grid} pings={pings} />
    </pixiContainer>
  );
}
