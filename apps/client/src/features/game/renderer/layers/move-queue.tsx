import { ActionType } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback } from "react";

import { getBoardPulse } from "#/features/game/renderer/board-motion";
import type { ArrowTrigonometry } from "#/features/game/renderer/layers/move-queue-geometry";
import {
  DIRECTION_TRIGONOMETRY,
  getArrowAnchor,
} from "#/features/game/renderer/layers/move-queue-geometry";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import type { MoveIntent } from "#/features/game/utils/move";
import { useMotionPreference } from "#/features/motion/motion-provider";

extend({ Graphics });

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
  alpha = 1,
) {
  const shape = g.poly(points).fill({
    color: RenderConfig.arrowColor,
    alpha,
  });
  if (strokeWidth > 0) {
    shape.stroke({
      width: strokeWidth,
      color: RenderConfig.arrowStrokeColor,
      alpha,
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
  grid: RenderGrid;
  moveQueue: MoveIntent[];
}

export function MoveQueueLayer({ grid, moveQueue }: MoveQueueLayerProps) {
  const { shouldReduceMotion } = useMotionPreference();

  // Only redraw when move queue changes
  const drawMoveQueue = useCallback(
    (g: Graphics) => {
      g.clear();

      // Create the base arrow shape points.
      const points = createArrowPoints();

      // Draw move queue arrows
      moveQueue.forEach((move, index) => {
        // Keep the whole arrow inside the departure cell for stronger contrast.
        const { anchorX, anchorY } = getArrowAnchor(grid, move);
        const trigonometry = DIRECTION_TRIGONOMETRY[move.direction];
        const pulse = getBoardPulse({
          ageMs: index * 80,
          reducedMotion: shouldReduceMotion,
        });

        if (move.type === ActionType.SPLIT_MOVE) {
          drawSplitArrow(g, points, anchorX, anchorY, trigonometry);
          return;
        }

        drawArrow(
          g,
          transformArrowPoints(points, anchorX, anchorY, trigonometry),
          RenderConfig.arrowStrokeWidth * pulse.scale,
          pulse.alpha,
        );
      });
    },
    [grid, moveQueue, shouldReduceMotion],
  );

  return <pixiGraphics draw={drawMoveQueue} />;
}
