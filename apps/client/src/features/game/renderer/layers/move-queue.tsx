import { ActionType } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { MoveIntent } from "#/features/game/utils/move";
import { MoveDirection } from "#/features/game/utils/move";

extend({ Graphics });

interface ArrowTrigonometry {
  cos: number;
  sin: number;
}

const DIRECTION_TRIGONOMETRY: Record<MoveDirection, ArrowTrigonometry> = {
  [MoveDirection.UP]: { cos: 0, sin: -1 },
  [MoveDirection.DOWN]: { cos: 0, sin: 1 },
  [MoveDirection.LEFT]: { cos: -1, sin: 0 },
  [MoveDirection.RIGHT]: { cos: 1, sin: 0 },
};

function getArrowPosition(move: MoveIntent, stride: number) {
  let edgeX = move.from.x * stride;
  let edgeY = move.from.y * stride;

  switch (move.direction) {
    case MoveDirection.UP:
      edgeX += stride / 2;
      break;
    case MoveDirection.DOWN:
      edgeX += stride / 2;
      edgeY += stride; // bottom edge
      break;
    case MoveDirection.LEFT:
      // edgeX remains left edge
      edgeY += stride / 2;
      break;
    case MoveDirection.RIGHT:
      edgeX += stride; // right edge
      edgeY += stride / 2;
      break;
  }

  return { edgeX, edgeY };
}

function createArrowPoints(thicknessRatio = 1): { x: number; y: number }[] {
  const halfLength = RenderConfig.arrowLength / 2;
  const halfThickness = (RenderConfig.arrowThickness * thicknessRatio) / 2;
  const headSize = RenderConfig.arrowHeadSize;

  // Define a right-pointing arrow centered at (0,0)
  // Midpoint of arrow is (0,0), so it spans from -L/2 to +L/2
  return [
    { x: -halfLength, y: -halfThickness }, // Back top
    { x: halfLength - headSize, y: -halfThickness }, // Shoulder top
    { x: halfLength - headSize, y: -headSize / 2 }, // Head base top
    { x: halfLength, y: 0 }, // Tip
    { x: halfLength - headSize, y: headSize / 2 }, // Head base bottom
    { x: halfLength - headSize, y: halfThickness }, // Shoulder bottom
    { x: -halfLength, y: halfThickness }, // Back bottom
  ];
}

function transformArrowPoints(
  points: { x: number; y: number }[],
  edgeX: number,
  edgeY: number,
  trigonometry: ArrowTrigonometry,
  offset = 0,
) {
  const { cos, sin } = trigonometry;

  return points.map(({ x, y }) => {
    const localY = y + offset;
    return {
      x: x * cos - localY * sin + edgeX,
      y: x * sin + localY * cos + edgeY,
    };
  });
}

function transformArrowPoint(
  point: { x: number; y: number },
  edgeX: number,
  edgeY: number,
  trigonometry: ArrowTrigonometry,
) {
  const { cos, sin } = trigonometry;
  return {
    x: point.x * cos - point.y * sin + edgeX,
    y: point.x * sin + point.y * cos + edgeY,
  };
}

function drawArrow(
  g: Graphics,
  points: { x: number; y: number }[],
  strokeWidth: number,
) {
  const shape = g.poly(points).fill(RenderConfig.arrowColor);
  if (strokeWidth > 0) {
    shape.stroke({
      width: strokeWidth,
      color: RenderConfig.arrowStrokeColor,
      join: "round",
    });
  }
}

function drawSplitArrow(
  g: Graphics,
  edgeX: number,
  edgeY: number,
  trigonometry: ArrowTrigonometry,
) {
  const points = transformArrowPoints(
    createArrowPoints(),
    edgeX,
    edgeY,
    trigonometry,
  );
  drawArrow(g, points, RenderConfig.arrowStrokeWidth);

  const halfLength = RenderConfig.arrowLength / 2;
  const barCenterX =
    -halfLength +
    RenderConfig.splitArrowBarInset +
    RenderConfig.splitArrowBarWidth / 2;
  const halfBarLength = RenderConfig.splitArrowBarLength / 2;
  const barStart = transformArrowPoint(
    { x: barCenterX, y: -halfBarLength },
    edgeX,
    edgeY,
    trigonometry,
  );
  const barEnd = transformArrowPoint(
    { x: barCenterX, y: halfBarLength },
    edgeX,
    edgeY,
    trigonometry,
  );

  g.moveTo(barStart.x, barStart.y).lineTo(barEnd.x, barEnd.y).stroke({
    width: RenderConfig.splitArrowBarWidth,
    color: RenderConfig.arrowColor,
    cap: "round",
  });
}

interface MoveQueueLayerProps {
  stride: number;
  moveQueue: MoveIntent[];
}

export function MoveQueueLayer({ stride, moveQueue }: MoveQueueLayerProps) {
  const drawMoveQueue = useCallback(
    (g: Graphics) => {
      g.clear();

      // Create the base arrow shape points.
      const points = createArrowPoints();

      // Draw move queue arrows
      moveQueue.forEach((move) => {
        // Find the center point of the edge between the "from" cell and the target
        const { edgeX, edgeY } = getArrowPosition(move, stride);
        const trigonometry = DIRECTION_TRIGONOMETRY[move.direction];

        if (move.type === ActionType.SPLIT_MOVE) {
          drawSplitArrow(g, edgeX, edgeY, trigonometry);
          return;
        }

        drawArrow(
          g,
          transformArrowPoints(points, edgeX, edgeY, trigonometry),
          RenderConfig.arrowStrokeWidth,
        );
      });
    },
    [moveQueue, stride],
  );

  return <pixiGraphics draw={drawMoveQueue} />;
}
