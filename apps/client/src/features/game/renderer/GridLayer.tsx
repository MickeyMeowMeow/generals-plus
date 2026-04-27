import { extend } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { useMemo } from "react";

import { GridCellView } from "#/features/game/renderer/components/GridCellView";
import { InteractionLayer } from "#/features/game/renderer/components/InteractionLayer";
import { MoveQueueLayer } from "#/features/game/renderer/components/MoveQueueLayer";
import {
  cellKeyFormatter,
  RenderCellIndex,
  RenderPlayerIndex,
  ViewportCuller,
} from "#/features/game/renderer/grid-model";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type {
  GameMapCallbacks,
  MoveQueueItem,
  RenderCell,
  RenderPlayer,
  RenderViewportState,
} from "#/features/game/renderer/render-types";

extend({ Container, Graphics, Sprite, Text });

interface GridLayerProps extends GameMapCallbacks {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly RenderCell[];
  readonly players: readonly RenderPlayer[];
  readonly moveQueue: readonly MoveQueueItem[];
  readonly stride: number;
  readonly viewport: RenderViewportState;
}

export function GridLayer({
  width,
  height,
  cells,
  players,
  moveQueue,
  stride,
  viewport,
  onCellClick,
  onCellHover,
  onCellLeave,
  onCellsSelect,
  onQueueItemRemove,
}: GridLayerProps) {
  const cellSize = stride - RenderConfig.cellGap;
  // Build lookup helpers once per input snapshot.
  const playerIndex = useMemo(() => new RenderPlayerIndex(players), [players]);
  const cellIndex = useMemo(
    () => new RenderCellIndex(width, height, cells),
    [width, height, cells],
  );
  const culler = useMemo(
    () => new ViewportCuller(stride, cellSize),
    [stride, cellSize],
  );
  const visibleCells = useMemo(
    // Draw only visible cells to reduce per-frame work.
    () => cells.filter((cell) => culler.isCellVisible(cell, viewport)),
    [cells, culler, viewport],
  );
  const worldWidth = width * stride - RenderConfig.cellGap;
  const worldHeight = height * stride - RenderConfig.cellGap;

  return (
    <pixiContainer>
      <pixiContainer>
        {visibleCells.map((cell) => (
          <GridCellView
            key={cellKeyFormatter.fromCell(cell)}
            cell={cell}
            ownerColor={playerIndex.ownerColor(cell.ownerIndex)}
            troopColor={playerIndex.troopColor(cell.ownerIndex)}
            stride={stride}
            cellSize={cellSize}
            scale={viewport.scale}
          />
        ))}
      </pixiContainer>
      <InteractionLayer
        width={width}
        height={height}
        stride={stride}
        cellSize={cellSize}
        cells={cellIndex}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        onCellClick={onCellClick}
        onCellHover={onCellHover}
        onCellLeave={onCellLeave}
        onCellsSelect={onCellsSelect}
      />
      <MoveQueueLayer
        queue={moveQueue}
        viewport={viewport}
        stride={stride}
        cellSize={cellSize}
        onQueueItemRemove={onQueueItemRemove}
      />
    </pixiContainer>
  );
}
