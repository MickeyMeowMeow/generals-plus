import type { ICoordinate, Terrain } from "@generals-plus/engine";
import { Grid2D, Visibility } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import type { FederatedPointerEvent } from "pixi.js";
import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { useCallback, useMemo } from "react";

import type { MoveIntent } from "#/features/game/renderer/move";
import { MoveDirection } from "#/features/game/renderer/move";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";

extend({ Container, Graphics, Sprite, Text });

export interface RenderGridCell {
  coordinate: ICoordinate;
  terrain: Terrain;
  troopCount: number | null;
  visibility: Visibility;
  ownerIndex: string | null;
}

export class RenderGrid extends Grid2D<RenderGridCell> {}

interface GridLayerProps {
  grid: RenderGrid;
  stride: number;
  selection: ICoordinate | null;
  moveQueue: MoveIntent[];
  onCellClick: (coordinate: ICoordinate) => void;
}

function tintColor(color: number, alpha: number): number {
  const r = ((color >> 16) & 0xff) * alpha;
  const g = ((color >> 8) & 0xff) * alpha;
  const b = (color & 0xff) * alpha;
  return (r << 16) | (g << 8) | b;
}

export function GridLayer({
  grid,
  stride,
  selection,
  moveQueue,
  onCellClick,
}: GridLayerProps) {
  const cellSize = stride - RenderConfig.cellGap;

  const onPointerDown = useCallback(
    (e: FederatedPointerEvent) => {
      const localPos = e.currentTarget.toLocal(e.global);
      const x = Math.floor(localPos.x / stride);
      const y = Math.floor(localPos.y / stride);
      if (x >= 0 && x < grid.width && y >= 0 && y < grid.height) {
        onCellClick({ x, y });
      }
    },
    [grid.width, grid.height, stride, onCellClick],
  );

  const drawBaseLayer = useCallback(
    (g: Graphics) => {
      g.clear();
      grid.forEach((cell) => {
        const x = cell.coordinate.x * stride;
        const y = cell.coordinate.y * stride;

        let color = cell.ownerIndex
          ? 0x000022 + (parseInt(cell.ownerIndex) + 1) * 0x003300
          : TerrainTheme[cell.terrain]?.color || 0xffffff;

        // Handle visibility
        if (cell.visibility === Visibility.HIDDEN) {
          color = 0x000000; // Total black for undiscovered
        } else if (cell.visibility === Visibility.SHROUDED) {
          // Simple way to "tint" for fog: darken the color
          color = tintColor(color, 0.5);
        }

        g.rect(x, y, cellSize, cellSize).fill(color);
      });
    },
    [grid, stride, cellSize],
  );

  const drawOverlayLayer = useCallback(
    (g: Graphics) => {
      g.clear();

      // Draw selection highlight
      if (selection) {
        g.setStrokeStyle({ width: 4, color: 0xffffff, alignment: 0 });
        g.rect(
          selection.x * stride,
          selection.y * stride,
          cellSize,
          cellSize,
        ).stroke();
      }

      // Draw move queue arrows
      moveQueue.forEach((move) => {
        // Find the center point of the edge between the "from" cell and the target
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

        const L = RenderConfig.arrowLength;
        const T = RenderConfig.arrowThickness / 2;
        const H = RenderConfig.arrowHeadSize;

        // Define a Right-pointing arrow centered at (0,0)
        // Midpoint of arrow is (0,0), so it spans from -L/2 to +L/2
        const points = [
          -L / 2,
          -T, // Back top
          L / 2 - H,
          -T, // Shoulder top
          L / 2 - H,
          -H / 2, // Head base top
          L / 2,
          0, // Tip
          L / 2 - H,
          H / 2, // Head base bottom
          L / 2 - H,
          T, // Shoulder bottom
          -L / 2,
          T, // Back bottom
        ];

        // Apply dark stroke and white fill to the polygon
        g.setStrokeStyle({
          width: RenderConfig.arrowStrokeWidth,
          color: RenderConfig.arrowStrokeColor,
          join: "round",
        });

        // Translate and rotate the graphic context to the edge center
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const transformedPoints = [];
        for (let i = 0; i < points.length; i += 2) {
          const px = points[i];
          const py = points[i + 1];
          transformedPoints.push(px * cos - py * sin + edgeX);
          transformedPoints.push(px * sin + py * cos + edgeY);
        }

        g.poly(transformedPoints).fill(RenderConfig.arrowColor).stroke();
      });
    },
    [selection, moveQueue, stride, cellSize],
  );

  const iconCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; icon: string }> = [];
    grid.forEach((cell) => {
      const icon = TerrainTheme[cell.terrain]?.icon;
      if (icon) cells.push({ cell, icon });
    });
    return cells;
  }, [grid]);

  const troopCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; count: number }> = [];
    grid.forEach((cell) => {
      if (cell.troopCount !== null && cell.troopCount !== undefined) {
        cells.push({ cell, count: cell.troopCount });
      }
    });
    return cells;
  }, [grid]);

  const troopTextStyle = useMemo(() => {
    return new TextStyle({
      fontFamily: RenderConfig.troopTextFontFamily,
      fontSize: cellSize * RenderConfig.troopTextFontSizeRatio,
      fontWeight: RenderConfig.troopTextFontWeight,
      fill: RenderConfig.troopTextColor,
      stroke: {
        color: RenderConfig.troopTextStrokeColor,
        width: RenderConfig.troopTextStrokeWidth,
      },
    });
  }, [cellSize]);

  return (
    <pixiContainer eventMode="static" onPointerDown={onPointerDown}>
      <pixiGraphics draw={drawBaseLayer} />
      <pixiGraphics draw={drawOverlayLayer} />
      <pixiContainer>
        {iconCells.map(({ cell, icon }) => {
          const x = cell.coordinate.x * stride + cellSize / 2;
          const y = cell.coordinate.y * stride + cellSize / 2;
          const iconSize = Math.max(
            1,
            cellSize * RenderConfig.terrainIconScale,
          );

          return (
            <pixiSprite
              key={`icon-${cell.coordinate.x},${cell.coordinate.y}`}
              texture={Texture.from(icon)}
              anchor={0.5}
              width={iconSize}
              height={iconSize}
              x={x}
              y={y}
            />
          );
        })}
      </pixiContainer>
      <pixiContainer>
        {troopCells.map(({ cell, count }) => {
          const x = cell.coordinate.x * stride + cellSize / 2;
          const y = cell.coordinate.y * stride + cellSize / 2;

          return (
            <pixiText
              key={`troop-${cell.coordinate.x},${cell.coordinate.y}`}
              text={count.toString()}
              anchor={0.5}
              x={x}
              y={y}
              style={troopTextStyle}
            />
          );
        })}
      </pixiContainer>
    </pixiContainer>
  );
}
