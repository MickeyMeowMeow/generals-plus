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

export function getArrowAnchor(move: MoveIntent, stride: number) {
  const trigonometry = DIRECTION_TRIGONOMETRY[move.direction];
  const halfLength = RenderConfig.arrowLength / 2;
  const tipInset = RenderConfig.arrowEdgeInset + halfLength;
  let anchorX = move.from.x * stride;
  let anchorY = move.from.y * stride;

  switch (move.direction) {
    case MoveDirection.UP:
      anchorX += stride / 2;
      break;
    case MoveDirection.DOWN:
      anchorX += stride / 2;
      anchorY += stride;
      break;
    case MoveDirection.LEFT:
      anchorY += stride / 2;
      break;
    case MoveDirection.RIGHT:
      anchorX += stride;
      anchorY += stride / 2;
      break;
  }

  return {
    anchorX: anchorX - trigonometry.cos * tipInset,
    anchorY: anchorY - trigonometry.sin * tipInset,
  };
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
  anchorX: number,
  anchorY: number,
  trigonometry: ArrowTrigonometry,
  offset = 0,
) {
  const { cos, sin } = trigonometry;

  return points.map(({ x, y }) => {
    const localY = y + offset;
    return {
      x: x * cos - localY * sin + anchorX,
      y: x * sin + localY * cos + anchorY,
    };
  });
}

function transformArrowPoint(
  point: { x: number; y: number },
  anchorX: number,
  anchorY: number,
  trigonometry: ArrowTrigonometry,
) {
  const { cos, sin } = trigonometry;
  return {
    x: point.x * cos - point.y * sin + anchorX,
    y: point.x * sin + point.y * cos + anchorY,
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
  points: { x: number; y: number }[],
  anchorX: number,
  anchorY: number,
  trigonometry: ArrowTrigonometry,
) {
  drawArrow(
    g,
    transformArrowPoints(points, anchorX, anchorY, trigonometry),
    RenderConfig.arrowStrokeWidth,
  );

  const halfLength = RenderConfig.arrowLength / 2;
  const barCenterX =
    -halfLength +
    RenderConfig.splitArrowBarInset +
    RenderConfig.splitArrowBarWidth / 2;
  const halfBarLength = RenderConfig.splitArrowBarLength / 2;
  const barStart = transformArrowPoint(
    { x: barCenterX, y: -halfBarLength },
    anchorX,
    anchorY,
    trigonometry,
  );
  const barEnd = transformArrowPoint(
    { x: barCenterX, y: halfBarLength },
    anchorX,
    anchorY,
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
        // Keep the whole arrow inside the departure cell for stronger contrast.
        const { anchorX, anchorY } = getArrowAnchor(move, stride);
        const trigonometry = DIRECTION_TRIGONOMETRY[move.direction];

        if (move.type === ActionType.SPLIT_MOVE) {
          drawSplitArrow(g, points, anchorX, anchorY, trigonometry);
          return;
        }

        drawArrow(
          g,
          transformArrowPoints(points, anchorX, anchorY, trigonometry),
          RenderConfig.arrowStrokeWidth,
        );
      });
    },
    [moveQueue, stride],
  );

  return <pixiGraphics draw={drawMoveQueue} />;
}
