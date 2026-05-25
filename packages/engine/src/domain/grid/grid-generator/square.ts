import { Terrain } from "#/domain/cell/terrain";
import { SquareGrid } from "#/domain/grid/grid";
import type {
  DominationGridOptions,
  GridGeneratorOptions,
  ResolvedConfig,
} from "#/domain/grid/grid-generator/config";
import { AbstractGridGenerator } from "#/domain/grid/grid-generator/generator";
import type { GenericGrid2D } from "#/math/grid-2d";
import { SquareGrid2D } from "#/math/grid-2d";

export class SquareGridGenerator extends AbstractGridGenerator<
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

  protected materializeCells(
    terrainGrid: SquareGrid2D<Terrain>,
    options: GridGeneratorOptions | DominationGridOptions,
  ): SquareGrid {
    const cells = terrainGrid.map((terrain, coordinate) =>
      this.createCell(options, terrain, coordinate),
    );
    return new SquareGrid(cells.width, cells.height, cells.gridData);
  }
}
