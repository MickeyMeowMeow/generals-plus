import { Terrain, Visibility } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Text, TextStyle } from "pixi.js";
import { useMemo } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";

extend({ Container, Text });

const siteLabelBaseStyle = {
  fontFamily: RenderConfig.siteLabelFontFamily,
  fontSize: RenderConfig.cellStride * RenderConfig.siteLabelFontSizeRatio,
  fontWeight: RenderConfig.siteLabelFontWeight,
  stroke: {
    color: RenderConfig.siteLabelStrokeColor,
    width: RenderConfig.siteLabelStrokeWidth,
  },
};

const SITE_TEXT_STYLE = new TextStyle({
  ...siteLabelBaseStyle,
  fill: RenderConfig.siteLabelColor,
});

const SHROUDED_SITE_TEXT_STYLE = new TextStyle({
  ...siteLabelBaseStyle,
  fill: 0x8a8d93,
});

interface SiteLabelLayerProps {
  grid: RenderGrid;
  tick?: number;
}

export function SiteLabelLayer({ grid, tick }: SiteLabelLayerProps) {
  // Assume that site labels remain unchanged across ticks, but we recompute when tick changes to handle in-place grid mutation on initialization.
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
  }, [grid, tick]);

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
            style={cell.visibility === Visibility.SHROUDED ? SHROUDED_SITE_TEXT_STYLE : SITE_TEXT_STYLE}
          />
        );
      })}
    </pixiContainer>
  );
}
