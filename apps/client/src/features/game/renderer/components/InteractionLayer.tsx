import type { Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { Rectangle } from "pixi.js";
import { useCallback, useMemo, useState } from "react";

import type { RenderCellIndex } from "#/features/game/renderer/grid-model";
import { GridCoordinateMapper } from "#/features/game/renderer/grid-model";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type {
  GameMapCallbacks,
  RenderPoint,
} from "#/features/game/renderer/render-types";

interface InteractionLayerProps extends GameMapCallbacks {
  readonly width: number;
  readonly height: number;
  readonly stride: number;
  readonly cellSize: number;
  readonly cells: RenderCellIndex;
  readonly worldWidth: number;
  readonly worldHeight: number;
}

function InteractionLayer({
  width,
  height,
  stride,
  cellSize,
  cells,
  worldWidth,
  worldHeight,
  onCellClick,
  onCellHover,
  onCellLeave,
}: InteractionLayerProps) {
  const mapper = useMemo(
    () => new GridCoordinateMapper(width, height, stride),
    [width, height, stride],
  );
  const hitArea = useMemo(
    () => new Rectangle(0, 0, worldWidth, worldHeight),
    [worldWidth, worldHeight],
  );
  const [selectedCell, setSelectedCell] = useState<RenderPoint | null>(null);
  const [hoveredCell, setHoveredCell] = useState<RenderPoint | null>(null);

  const pointFromEvent = useCallback((event: FederatedPointerEvent) => {
    // Convert pointer position into local world coordinates.
    const local = event.getLocalPosition(event.currentTarget as Container);
    return { x: local.x, y: local.y };
  }, []);

  const clearHover = useCallback(() => {
    if (hoveredCell) {
      setHoveredCell(null);
      onCellLeave?.();
    }
  }, [hoveredCell, onCellLeave]);

  const updateHover = useCallback(
    (point: RenderPoint) => {
      const coordinate = mapper.pointToCoordinate(point);
      if (!coordinate) {
        clearHover();
        return;
      }

      const cell = cells.visibleCellAt(coordinate);
      if (!cell) {
        clearHover();
        return;
      }

      if (hoveredCell?.x === coordinate.x && hoveredCell.y === coordinate.y) {
        return;
      }

      setHoveredCell(coordinate);
      onCellHover?.(coordinate.x, coordinate.y);
    },
    [cells, clearHover, hoveredCell, mapper, onCellHover],
  );

  const handlePointerDown = useCallback((_event: FederatedPointerEvent) => {
    // No-op: all interactions are handled in handlePointerUp.
    // Left-click is reserved for viewport dragging.
  }, []);

  const handlePointerMove = useCallback(
    (event: FederatedPointerEvent) => {
      const point = pointFromEvent(event);
      updateHover(point);
    },
    [pointFromEvent, updateHover],
  );

  const handleGlobalPointerMove = useCallback(
    (event: FederatedPointerEvent) => {
      updateHover(pointFromEvent(event));
    },
    [pointFromEvent, updateHover],
  );

  const handlePointerUp = useCallback(
    (event: FederatedPointerEvent) => {
      // Only handle left-button single-cell clicks.
      if (event.button !== 0) return;

      const point = pointFromEvent(event);
      const coordinate = mapper.pointToCoordinate(point);
      if (!coordinate) return;

      const cell = cells.visibleCellAt(coordinate);
      if (!cell) return;

      setSelectedCell((current) => {
        if (current?.x === coordinate.x && current.y === coordinate.y) {
          return null;
        }
        return coordinate;
      });
      onCellClick?.(coordinate.x, coordinate.y);
    },
    [cells, mapper, onCellClick, pointFromEvent],
  );

  const handlePointerLeave = useCallback(
    (_event: FederatedPointerEvent) => {
      clearHover();
    },
    [clearHover],
  );

  const drawOverlay = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(0, 0, worldWidth, worldHeight).fill({ color: 0x000000, alpha: 0 });

      if (selectedCell) {
        g.rect(
          selectedCell.x * stride + 2,
          selectedCell.y * stride + 2,
          cellSize - 4,
          cellSize - 4,
        ).stroke({
          color: RenderConfig.selectionBorderColor,
          width: 5,
          alpha: 1,
        });
      }

      if (hoveredCell) {
        g.rect(
          hoveredCell.x * stride + 4,
          hoveredCell.y * stride + 4,
          cellSize - 8,
          cellSize - 8,
        ).stroke({
          color: RenderConfig.hoverBorderColor,
          width: 4,
          alpha: 0.96,
        });
      }
    },
    [cellSize, hoveredCell, selectedCell, stride, worldHeight, worldWidth],
  );

  return (
    <pixiGraphics
      draw={drawOverlay}
      eventMode="static"
      cursor="crosshair"
      hitArea={hitArea}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onGlobalPointerMove={handleGlobalPointerMove}
      onPointerUp={handlePointerUp}
      onPointerUpOutside={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    />
  );
}

export { InteractionLayer };
