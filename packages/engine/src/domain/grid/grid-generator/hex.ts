import { Terrain } from "#/domain/cell/terrain";
import { HexGrid } from "#/domain/grid/grid";
import type {
  GridGeneratorOptions,
  ResolvedConfig,
} from "#/domain/grid/grid-generator/config";
import { DefaultGridBounds } from "#/domain/grid/grid-generator/config";
import { AbstractGridGenerator } from "#/domain/grid/grid-generator/generator";
import type { GenericGrid2D, GridBounds } from "#/math/grid-2d";
import { GridType, HexGrid2D } from "#/math/grid-2d";

export class HexGridGenerator extends AbstractGridGenerator<
  typeof GridType.HEX,
  GenericGrid2D<Terrain>,
  HexGrid
> {
  protected createEmptyTerrainGrid(
    config: ResolvedConfig<typeof GridType.HEX>,
  ): HexGrid2D<Terrain> {
    return HexGrid2D.generate(
      config.gridBounds.left,
      config.gridBounds.right,
      config.gridBounds.leftSlant,
      config.gridBounds.rightSlant,
      () => Terrain.PLAIN,
    );
  }

  protected resolveGridBounds(
    options: GridGeneratorOptions<typeof GridType.HEX>,
  ): GridBounds[typeof GridType.HEX] {
    return options.gridBounds ?? DefaultGridBounds[GridType.HEX];
  }

  protected calculateMinGeneralDistance(
    config: ResolvedConfig<typeof GridType.HEX>,
  ): number {
    return Math.floor(
      Math.min(
        config.gridBounds.left + config.gridBounds.right,
        config.gridBounds.leftSlant,
        config.gridBounds.rightSlant,
      ) * config.minGeneralDistanceFactor,
    );
  }

  protected materializeCells(
    terrainGrid: HexGrid2D<Terrain>,
    options: GridGeneratorOptions<typeof GridType.HEX>,
  ): HexGrid {
    const cells = terrainGrid.map((terrain, coordinate) =>
      this.createCell(options, terrain, coordinate),
    );
    return new HexGrid(
      cells.left,
      cells.right,
      cells.leftSlant,
      cells.rightSlant,
      cells.gridData,
    );
  }
}
