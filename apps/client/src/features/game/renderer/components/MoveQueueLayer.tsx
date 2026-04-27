import type { FederatedPointerEvent, Graphics } from "pixi.js";
import { useCallback, useMemo } from "react";

import { ViewportCuller } from "#/features/game/renderer/grid-model";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type {
  MoveQueueItem,
  RenderViewportState,
} from "#/features/game/renderer/render-types";

interface MoveQueueLayerProps {
  readonly queue: readonly MoveQueueItem[];
  readonly viewport: RenderViewportState;
  readonly stride: number;
  readonly cellSize: number;
  readonly onQueueItemRemove?: (order: number) => void;
}

interface MoveQueueArrowProps {
  readonly item: MoveQueueItem;
  readonly stride: number;
  readonly cellSize: number;
  readonly onQueueItemRemove?: (order: number) => void;
}

function MoveQueueArrow({
  item,
  stride,
  cellSize,
  onQueueItemRemove,
}: MoveQueueArrowProps) {
  const culler = useMemo(
    () => new ViewportCuller(stride, cellSize),
    [stride, cellSize],
  );
  const from = culler.cellCenter(item.from);
  const to = culler.cellCenter(item.to);
  const color = item.isSplit
    ? RenderConfig.splitMoveColor
    : RenderConfig.fullMoveColor;
  const alpha = item.isSplit
    ? RenderConfig.moveSplitAlpha
    : RenderConfig.moveFullAlpha;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

  const drawArrow = useCallback(
    (g: Graphics) => {
      g.clear();
      // Draw a center-to-center arrow trimmed to avoid overlapping cell centers.
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const headLength = Math.max(
        RenderConfig.moveHeadMinLength,
        cellSize * RenderConfig.moveHeadScale,
      );
      const endX =
        to.x - Math.cos(angle) * (cellSize * RenderConfig.moveTrimFactor);
      const endY =
        to.y - Math.sin(angle) * (cellSize * RenderConfig.moveTrimFactor);
      const startX =
        from.x + Math.cos(angle) * (cellSize * RenderConfig.moveTrimFactor);
      const startY =
        from.y + Math.sin(angle) * (cellSize * RenderConfig.moveTrimFactor);

      g.moveTo(startX, startY)
        .lineTo(endX, endY)
        .stroke({
          color,
          width: item.isSplit
            ? RenderConfig.moveArrowSplitWidth
            : RenderConfig.moveArrowFullWidth,
          alpha,
        });
      g.moveTo(endX, endY)
        .lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6),
        )
        .lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6),
        )
        .lineTo(endX, endY)
        .fill({ color, alpha });

      if (item.isSplit) {
        g.circle(from.x, from.y, RenderConfig.moveSplitMarkerRadius).stroke({
          color,
          width: RenderConfig.moveArrowSplitWidth - 1,
          alpha,
        });
      }
    },
    [alpha, cellSize, color, from.x, from.y, item.isSplit, to.x, to.y],
  );

  const drawBadge = useCallback(
    (g: Graphics) => {
      g.clear();
      g.circle(mid.x, mid.y, RenderConfig.moveBadgeRadius)
        .fill({ color, alpha: RenderConfig.moveBadgeFillAlpha })
        .stroke({
          color: RenderConfig.textStrokeColor,
          width: RenderConfig.moveBadgeStrokeWidth,
          alpha: 0.9,
        });
    },
    [color, mid.x, mid.y],
  );

  const removeQueueItem = useCallback(
    (event: FederatedPointerEvent) => {
      event.stopPropagation();
      // Queue order acts as a stable deletion key for the outer state.
      onQueueItemRemove?.(item.order);
    },
    [item.order, onQueueItemRemove],
  );

  return (
    <pixiContainer>
      <pixiGraphics draw={drawArrow} />
      <pixiContainer
        eventMode="static"
        cursor="pointer"
        onPointerTap={removeQueueItem}
      >
        <pixiGraphics draw={drawBadge} />
        <pixiText
          text={String(item.order)}
          anchor={RenderConfig.centerAnchor}
          x={mid.x}
          y={mid.y}
          style={{
            fill: RenderConfig.queueLabelColor,
            fontFamily: RenderConfig.fontFamily,
            fontSize: RenderConfig.queueLabelFontSize,
            fontWeight: RenderConfig.fontWeightBold,
            align: "center",
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

function MoveQueueLayer({
  queue,
  viewport,
  stride,
  cellSize,
  onQueueItemRemove,
}: MoveQueueLayerProps) {
  const culler = useMemo(
    () => new ViewportCuller(stride, cellSize),
    [stride, cellSize],
  );
  const visibleQueue = useMemo(
    () => queue.filter((item) => culler.isQueueItemVisible(item, viewport)),
    [culler, queue, viewport],
  );

  return (
    <pixiContainer>
      {visibleQueue.map((item) => (
        <MoveQueueArrow
          key={item.order}
          item={item}
          stride={stride}
          cellSize={cellSize}
          onQueueItemRemove={onQueueItemRemove}
        />
      ))}
    </pixiContainer>
  );
}

export { MoveQueueLayer };
