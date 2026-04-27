import type { Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { Rectangle } from "pixi.js";
import { useCallback, useMemo, useRef, useState } from "react";

import type {
  RenderCellIndex,
  SelectionRect,
} from "#/features/game/renderer/grid-model.ts";
import {
  GridCoordinateMapper,
  PointerDragState,
} from "#/features/game/renderer/grid-model.ts";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type {
  GameMapCallbacks,
  RenderPoint,
} from "#/features/game/renderer/render-types.ts";

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
  onCellsSelect,
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
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(
    null,
  );
  const dragStateRef = useRef<PointerDragState | null>(null);

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

  const handlePointerDown = useCallback(
    (event: FederatedPointerEvent) => {
      if (event.button !== 0) return;

      event.stopPropagation();
      const point = pointFromEvent(event);
      dragStateRef.current = new PointerDragState(point, point, false);
      setSelectionRect(null);
    },
    [pointFromEvent],
  );

  const handlePointerMove = useCallback(
    (event: FederatedPointerEvent) => {
      const point = pointFromEvent(event);
      const dragState = dragStateRef.current;

      if (!dragState) {
        updateHover(point);
        return;
      }

      event.stopPropagation();
      const nextDragState = dragState.update(point);
      dragStateRef.current = nextDragState;

      // Promote click intent to drag-select once threshold is exceeded.
      if (nextDragState.isSelecting) {
        setSelectionRect(mapper.selectionRect(nextDragState.start, point));
      }
    },
    [mapper, pointFromEvent, updateHover],
  );

  const handleGlobalPointerMove = useCallback(
    (event: FederatedPointerEvent) => {
      if (dragStateRef.current) return;

      updateHover(pointFromEvent(event));
    },
    [pointFromEvent, updateHover],
  );

  const handlePointerUp = useCallback(
    (event: FederatedPointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      event.stopPropagation();
      const point = pointFromEvent(event);
      const nextDragState = dragState.update(point);
      dragStateRef.current = null;
      setSelectionRect(null);

      if (nextDragState.isSelecting) {
        const selected = cells.selectVisibleCells(
          mapper.selectionRect(nextDragState.start, point),
        );
        onCellsSelect?.(selected);
        return;
      }

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
    [cells, mapper, onCellClick, onCellsSelect, pointFromEvent],
  );

  const handlePointerLeave = useCallback(
    (event: FederatedPointerEvent) => {
      if (dragStateRef.current) {
        event.stopPropagation();
      }
      clearHover();
    },
    [clearHover],
  );

  const drawOverlay = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(0, 0, worldWidth, worldHeight).fill({ color: 0x000000, alpha: 0 });

      if (selectionRect) {
        // Draw the current drag-selection rectangle.
        const rect = selectionRect.toWorldRect(stride);
        g.rect(rect.x, rect.y, rect.width, rect.height)
          .fill({ color: RenderConfig.selectionFillColor, alpha: 0.16 })
          .stroke({
            color: RenderConfig.selectionFillColor,
            width: 3,
            alpha: 0.95,
          });
      }

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
    [
      cellSize,
      hoveredCell,
      selectedCell,
      selectionRect,
      stride,
      worldHeight,
      worldWidth,
    ],
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
