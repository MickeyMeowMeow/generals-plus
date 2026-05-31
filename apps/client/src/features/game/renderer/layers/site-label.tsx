import { Terrain } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Text, TextStyle } from "pixi.js";
import { useMemo } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";

extend({ Container, Text });

const SITE_TEXT_STYLE = new TextStyle({
  fontFamily: RenderConfig.siteLabelFontFamily,
  fontSize: RenderConfig.cellStride * RenderConfig.siteLabelFontSizeRatio,
  fontWeight: RenderConfig.siteLabelFontWeight,
  fill: RenderConfig.siteLabelColor,
  stroke: {
    color: RenderConfig.siteLabelStrokeColor,
    width: RenderConfig.siteLabelStrokeWidth,
  },
});

interface SiteLabelLayerProps {
  grid: RenderGrid;
}

export function SiteLabelLayer({ grid }: SiteLabelLayerProps) {
  // Assume that site labels remain unchanged across ticks, so only compute once on mount.
  const siteCells = useMemo(() => {
    const cells: Array<{ cell: RenderGridCell; label: string }> = [];
    grid.forEach((cell) => {
      if (
        cell.terrain === Terrain.BOMB_SITE &&
        cell.siteIndex !== null &&
        cell.siteIndex !== undefined &&
        cell.siteIndex >= 0
      ) {
        cells.push({
          cell,
          label: String.fromCharCode(65 + cell.siteIndex),
        });
      }
    });
    return cells;
  }, [grid]);

  return (
    <pixiContainer>
      {siteCells.map(({ cell, label }) => {
        const { x, y } = grid.toCartesian(cell.coordinate);

        return (
          <pixiText
            key={`site-label-${cell.coordinate.x},${cell.coordinate.y}`}
            text={label}
            anchor={0.5}
            x={x * RenderConfig.cellStride}
            y={y * RenderConfig.cellStride}
            style={SITE_TEXT_STYLE}
          />
        );
      })}
    </pixiContainer>
  );
}
