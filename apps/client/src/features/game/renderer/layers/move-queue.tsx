import { ActionType } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { MoveIntent } from "#/features/game/utils/move";
import { MoveDirection } from "#/features/game/utils/move";

extend({ Graphics });

function getArrowPosition(move: MoveIntent, stride: number) {
  let edgeX = move.from.x * stride;
  let edgeY = move.from.y * stride;
  let rotation = 0;

  switch (move.direction) {
    case MoveDirection.UP:
      edgeX += stride / 2;
      // edgeY remains top edge
      rotation = -Math.PI / 2;
      break;
    case MoveDirection.DOWN:
      edgeX += stride / 2;
      edgeY += stride; // bottom edge
      rotation = Math.PI / 2;
      break;
    case MoveDirection.LEFT:
      // edgeX remains left edge
      edgeY += stride / 2;
      rotation = Math.PI;
      break;
    case MoveDirection.RIGHT:
      edgeX += stride; // right edge
      edgeY += stride / 2;
      rotation = 0;
      break;
  }

  return { edgeX, edgeY, rotation };
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
  rotation: number,
  offset = 0,
) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return points.map(({ x, y }) => {
    const localY = y + offset;
    return {
      x: x * cos - localY * sin + edgeX,
      y: x * sin + localY * cos + edgeY,
    };
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

      // Apply dark stroke and white fill to the polygon
      g.setStrokeStyle({
        width: RenderConfig.arrowStrokeWidth,
        color: RenderConfig.arrowStrokeColor,
        join: "round",
      });

      // Create the base arrow shape points.
      const points = createArrowPoints();
      const splitPoints = createArrowPoints(0.45);
      const splitOffset = RenderConfig.arrowThickness * 0.75;

      // Draw move queue arrows
      moveQueue.forEach((move) => {
        // Find the center point of the edge between the "from" cell and the target
        const { edgeX, edgeY, rotation } = getArrowPosition(move, stride);

        if (move.type === ActionType.SPLIT_MOVE) {
          g.poly(
            transformArrowPoints(
              splitPoints,
              edgeX,
              edgeY,
              rotation,
              -splitOffset,
            ),
          )
            .fill(RenderConfig.arrowColor)
            .stroke();
          g.poly(
            transformArrowPoints(
              splitPoints,
              edgeX,
              edgeY,
              rotation,
              splitOffset,
            ),
          )
            .fill(RenderConfig.arrowColor)
            .stroke();
          return;
        }

        g.poly(transformArrowPoints(points, edgeX, edgeY, rotation))
          .fill(RenderConfig.arrowColor)
          .stroke();
      });
    },
    [moveQueue, stride],
  );

  return <pixiGraphics draw={drawMoveQueue} />;
}
