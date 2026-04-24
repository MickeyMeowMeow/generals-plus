import type { IGrid } from "@generals-plus/engine";
import { Container, Graphics, Sprite, Texture } from "pixi.js";

import { getTerrainColor } from "#features/match/renderer/gridColors";
import { renderConfig } from "#features/match/renderer/renderConfig";
import { getTerrainIconUrl } from "#features/match/renderer/terrainAssets";

/**
 * Pixel dimensions available to the grid renderer.
 */
interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Draws the mode-independent terrain layer for a grid.
 */
export class GridRenderer {
  readonly container = new Container();
  private readonly baseLayer = new Graphics();
  private readonly iconLayer = new Container();

  constructor() {
    this.container.addChild(this.baseLayer);
    this.container.addChild(this.iconLayer);
  }

  /**
   * Redraws the base terrain layer for the supplied viewport.
   */
  render(grid: IGrid, viewport: ViewportSize): void {
    const layout = getGridLayout(grid, viewport);
    this.baseLayer.clear();
    this.clearIconLayer();

    grid.forEach((cell) => {
      const x = layout.offsetX + cell.coordinate.x * layout.stride;
      const y = layout.offsetY + cell.coordinate.y * layout.stride;

      this.baseLayer.beginFill(getTerrainColor(cell.terrain));
      this.baseLayer.drawRect(x, y, layout.cellSize, layout.cellSize);
      this.baseLayer.endFill();

      const iconUrl = getTerrainIconUrl(cell.terrain);

      if (iconUrl) {
        const icon = createTerrainIcon(iconUrl, x, y, layout.cellSize);
        this.iconLayer.addChild(icon);
      }
    });
  }

  /**
   * Releases Pixi display objects owned by this renderer.
   */
  destroy(): void {
    this.container.destroy({ children: true });
  }

  private clearIconLayer(): void {
    for (const child of this.iconLayer.removeChildren()) {
      child.destroy();
    }
  }
}

/**
 * Calculates a centered, bounded square-cell layout for the current viewport.
 */
function getGridLayout(grid: IGrid, viewport: ViewportSize) {
  const availableWidth = Math.max(
    viewport.width - renderConfig.stagePadding * 2,
    1,
  );
  const availableHeight = Math.max(
    viewport.height - renderConfig.stagePadding * 2,
    1,
  );
  const strideX = availableWidth / grid.width;
  const strideY = availableHeight / grid.height;
  const stride = Math.max(
    renderConfig.minCellSize,
    Math.min(renderConfig.maxCellSize, strideX, strideY),
  );
  const cellSize = Math.max(1, stride - renderConfig.cellGap);
  const gridWidth = grid.width * stride - renderConfig.cellGap;
  const gridHeight = grid.height * stride - renderConfig.cellGap;

  return {
    cellSize,
    stride,
    offsetX: Math.max(
      (viewport.width - gridWidth) / 2,
      renderConfig.stagePadding,
    ),
    offsetY: Math.max(
      (viewport.height - gridHeight) / 2,
      renderConfig.stagePadding,
    ),
  };
}

/**
 * Creates a centered terrain sprite scaled to sit inside one square cell.
 */
function createTerrainIcon(
  iconUrl: string,
  cellX: number,
  cellY: number,
  cellSize: number,
): Sprite {
  const icon = Sprite.from(Texture.from(iconUrl));
  const iconSize = Math.max(1, cellSize * renderConfig.terrainIconScale);

  icon.anchor.set(0.5);
  icon.width = iconSize;
  icon.height = iconSize;
  icon.x = cellX + cellSize / 2;
  icon.y = cellY + cellSize / 2;

  return icon;
}
