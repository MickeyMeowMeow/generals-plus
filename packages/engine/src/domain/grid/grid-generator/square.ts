import { Terrain } from "#/domain/cell/terrain";
import { SquareGrid } from "#/domain/grid/grid";
import type {
  GridGeneratorOptions,
  ResolvedConfig,
} from "#/domain/grid/grid-generator/config";
import {
  DefaultGridBounds,
  MIN_HEIGHT,
  MIN_WIDTH,
} from "#/domain/grid/grid-generator/config";
import { AbstractGridGenerator } from "#/domain/grid/grid-generator/generator";
import type { GenericGrid2D } from "#/math/grid-2d";
import { GridType, SquareGrid2D } from "#/math/grid-2d";

export class SquareGridGenerator extends AbstractGridGenerator<
  typeof GridType.SQUARE,
  GenericGrid2D<Terrain>,
  SquareGrid
> {
  protected createEmptyTerrainGrid(
    config: ResolvedConfig,
  ): SquareGrid2D<Terrain> {
    return SquareGrid2D.generate(
      config.gridBounds.width,
      config.gridBounds.height,
      () => Terrain.PLAIN,
    );
  }

  protected resolveGridBounds(
    options: GridGeneratorOptions<typeof GridType.SQUARE>,
  ): {
    width: number;
    height: number;
  } {
    const { width, height } =
      options.gridBounds ?? DefaultGridBounds[GridType.SQUARE];

    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      throw new Error(
        `Grid dimensions must be at least ${MIN_WIDTH}x${MIN_HEIGHT}, got ${width}x${height}.`,
      );
    }

    return {
      width,
      height,
    };
  }

  protected calculateMinGeneralDistance(
    config: ResolvedConfig<typeof GridType.SQUARE>,
  ): number {
    return Math.floor(
      Math.min(config.gridBounds.width, config.gridBounds.height) *
        config.minGeneralDistanceFactor,
    );
  }

  protected materializeCells(
    terrainGrid: SquareGrid2D<Terrain>,
    options: GridGeneratorOptions,
  ): SquareGrid {
    const cells = terrainGrid.map((terrain, coordinate) =>
      this.createCell(options, terrain, coordinate),
    );
    return new SquareGrid(cells.width, cells.height, cells.gridData);
  }
}
