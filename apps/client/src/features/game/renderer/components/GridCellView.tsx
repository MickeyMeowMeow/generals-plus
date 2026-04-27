import type { Graphics } from "pixi.js";
import { Texture } from "pixi.js";
import { memo, useCallback } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderCell } from "#/features/game/renderer/render-types";
import { TerrainTheme } from "#/features/game/renderer/theme";

interface GridCellViewProps {
  readonly cell: RenderCell;
  readonly ownerColor: number | null;
  readonly troopColor: number;
  readonly stride: number;
  readonly cellSize: number;
}

interface CellMemoProps {
  readonly cell: RenderCell;
  readonly ownerColor: number | null;
  readonly troopColor: number;
  readonly stride: number;
  readonly cellSize: number;
}

function GridCellViewContent({
  cell,
  ownerColor,
  troopColor,
  stride,
  cellSize,
}: GridCellViewProps) {
  const x = cell.x * stride;
  const y = cell.y * stride;
  const terrainTheme = TerrainTheme[cell.terrain];
  const iconSize = Math.max(1, cellSize * RenderConfig.terrainIconScale);
  const textVisible = cell.isVisible && cell.troopCount > 0;

  const drawCell = useCallback(
    (g: Graphics) => {
      g.clear();

      // Hidden cells are rendered as fog and skip all other overlays.
      if (!cell.isVisible) {
        g.rect(x, y, cellSize, cellSize).fill({
          color: RenderConfig.fogColor,
          alpha: RenderConfig.fogAlpha,
        });
        return;
      }

      g.rect(x, y, cellSize, cellSize).fill(terrainTheme.color);

      if (ownerColor !== null) {
        g.rect(x, y, cellSize, cellSize).fill({
          color: ownerColor,
          alpha: RenderConfig.ownerOverlayAlpha,
        });
      }
    },
    [cell.isVisible, cellSize, ownerColor, terrainTheme.color, x, y],
  );

  return (
    <pixiContainer>
      <pixiGraphics draw={drawCell} />
      {cell.isVisible && terrainTheme.icon ? (
        <pixiSprite
          texture={Texture.from(terrainTheme.icon)}
          anchor={RenderConfig.centerAnchor}
          width={iconSize}
          height={iconSize}
          x={x + cellSize / 2}
          y={y + cellSize / 2}
        />
      ) : null}
      {textVisible ? (
        <pixiText
          text={String(cell.troopCount)}
          anchor={RenderConfig.centerAnchor}
          x={x + cellSize / 2}
          y={y + cellSize / 2}
          style={{
            fill: troopColor,
            fontFamily: RenderConfig.fontFamily,
            fontSize: RenderConfig.troopFontSize,
            fontWeight: RenderConfig.fontWeightBold,
            stroke: {
              color: RenderConfig.textStrokeColor,
              width: RenderConfig.textStrokeWidth,
            },
            align: "center",
          }}
        />
      ) : null}
    </pixiContainer>
  );
}

class CellMemoComparator {
  /**
   * Keep cell renders stable unless relevant visual inputs change.
   */
  equals(prev: CellMemoProps, next: CellMemoProps): boolean {
    return (
      prev.cell.x === next.cell.x &&
      prev.cell.y === next.cell.y &&
      prev.cell.terrain === next.cell.terrain &&
      prev.cell.troopCount === next.cell.troopCount &&
      prev.cell.ownerIndex === next.cell.ownerIndex &&
      prev.cell.isVisible === next.cell.isVisible &&
      prev.ownerColor === next.ownerColor &&
      prev.troopColor === next.troopColor &&
      prev.stride === next.stride &&
      prev.cellSize === next.cellSize
    );
  }
}

const cellMemoComparator = new CellMemoComparator();

export const GridCellView = memo(GridCellViewContent, (prev, next) =>
  cellMemoComparator.equals(prev, next),
);
