import type { ICoordinate } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Graphics } from "pixi.js";
import { useCallback, useMemo } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { drawCell } from "#/features/game/utils/renderer";

extend({ Graphics });

interface PayloadLayerProps {
  readonly grid: RenderGrid;
  readonly payloadTrackX?: number[];
  readonly payloadTrackY?: number[];
  readonly cartIndex: number;
  readonly cartSize: number;
}

export function PayloadLayer({
  grid,
  payloadTrackX = [],
  payloadTrackY = [],
  cartIndex,
  cartSize,
}: PayloadLayerProps) {
  // Map track coordinates to pixel coordinates
  const trackPoints = useMemo(() => {
    if (!payloadTrackX || !payloadTrackY || payloadTrackX.length === 0)
      return [];
    const points = [];
    for (let i = 0; i < payloadTrackX.length; i++) {
      const coord = { x: payloadTrackX[i], y: payloadTrackY[i] };
      const cartesian = grid.toCartesian(coord);
      points.push({
        coord,
        pixelX: cartesian.x * RenderConfig.cellStride,
        pixelY: cartesian.y * RenderConfig.cellStride,
      });
    }
    return points;
  }, [payloadTrackX, payloadTrackY, grid]);

  // Compute coordinates covered by the cart
  const cartCoordinates = useMemo(() => {
    if (
      !grid ||
      cartIndex < 0 ||
      !payloadTrackX ||
      !payloadTrackY ||
      payloadTrackX[cartIndex] === undefined
    ) {
      return [];
    }
    const center = { x: payloadTrackX[cartIndex], y: payloadTrackY[cartIndex] };
    const K = cartSize || 3;
    const startOffset = -Math.floor((K - 1) / 2);
    const endOffset = Math.floor(K / 2);

    const coords: ICoordinate[] = [];
    for (let dy = startOffset; dy <= endOffset; dy++) {
      for (let dx = startOffset; dx <= endOffset; dx++) {
        const coord = { x: center.x + dx, y: center.y + dy };
        if (grid.isValid(coord)) {
          coords.push(coord);
        }
      }
    }
    return coords;
  }, [grid, cartIndex, payloadTrackX, payloadTrackY, cartSize]);

  // Handle Pixi rendering callback
  const drawPayload = useCallback(
    (g: Graphics) => {
      g.clear();

      if (trackPoints.length === 0) return;

      // 1. Draw Railway Track Line
      g.moveTo(trackPoints[0].pixelX, trackPoints[0].pixelY);
      for (let i = 1; i < trackPoints.length; i++) {
        g.lineTo(trackPoints[i].pixelX, trackPoints[i].pixelY);
      }
      g.stroke({
        width: 8,
        color: 0x1e293b, // Dark base road
        alpha: 0.5,
      });

      g.moveTo(trackPoints[0].pixelX, trackPoints[0].pixelY);
      for (let i = 1; i < trackPoints.length; i++) {
        g.lineTo(trackPoints[i].pixelX, trackPoints[i].pixelY);
      }
      g.stroke({
        width: 2.5,
        color: 0x0ea5e9, // Glowing Sky Blue core rail
        alpha: 0.85,
      });

      // 3. Draw Checkered/Glowing Gate zones at the start and end of the track
      // Left Base / Start of track (Index 0)
      const pStart = trackPoints[0];
      g.circle(pStart.pixelX, pStart.pixelY, 15);
      g.stroke({ width: 2, color: 0xf43f5e, alpha: 0.8 }); // Neon Rose
      g.fill({ color: 0xf43f5e, alpha: 0.25 });
      g.circle(pStart.pixelX, pStart.pixelY, 6);
      g.stroke({ width: 1.5, color: 0xf43f5e, alpha: 0.9 });
      g.fill({ color: 0xf43f5e, alpha: 0.9 });

      // Right Base / End of track (Index Length - 1)
      const pEnd = trackPoints[trackPoints.length - 1];
      g.circle(pEnd.pixelX, pEnd.pixelY, 15);
      g.stroke({ width: 2, color: 0x10b981, alpha: 0.8 }); // Neon Emerald Green
      g.fill({ color: 0x10b981, alpha: 0.25 });
      g.circle(pEnd.pixelX, pEnd.pixelY, 6);
      g.stroke({ width: 1.5, color: 0x10b981, alpha: 0.9 });
      g.fill({ color: 0x10b981, alpha: 0.9 });

      // 4. Highlight KxK Cart Bounding Cells
      for (const coord of cartCoordinates) {
        drawCell(g, grid, coord);
        g.fill({
          color: 0x0284c7, // Sky Blue fill
          alpha: 0.15,
        });
        g.stroke({
          width: 3,
          color: 0x38bdf8, // Sky light highlight
          alpha: 0.8,
        });
      }

      // 5. Draw the Floating High-Tech Energy Cart Core in the center
      const centerPoint = trackPoints[cartIndex];
      if (centerPoint) {
        const cx = centerPoint.pixelX;
        const cy = centerPoint.pixelY;

        // Bouncing energy shield ring
        g.circle(cx, cy, 15);
        g.stroke({
          width: 1.5,
          color: 0xffffff,
          alpha: 0.7,
        });
        g.fill({
          color: 0x0ea5e9,
          alpha: 0.2,
        });

        // Glowing Core diamond shape
        g.poly([
          { x: cx, y: cy - 10 },
          { x: cx + 10, y: cy },
          { x: cx, y: cy + 10 },
          { x: cx - 10, y: cy },
        ]);
        g.fill({ color: 0x38bdf8 });
        g.stroke({ width: 2, color: 0xffffff, alpha: 0.95 });

        // Energy Core center dot
        g.circle(cx, cy, 3.5);
        g.fill({ color: 0xffffff });
      }
    },
    [trackPoints, cartCoordinates, cartIndex, grid],
  );

  return <pixiGraphics draw={drawPayload} />;
}
