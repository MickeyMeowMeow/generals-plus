import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import type { EffectTarget } from "#/domain/effect/effect-target";
import type { ICoordinate } from "#/math/coordinate";
import { Grid2D } from "#/math/grid-2d";

export class Grid extends Grid2D<ICell> implements EffectTarget {
  private readonly terrainMap: Map<Terrain, Set<ICell>> = new Map();

  constructor(width: number, height: number, cells: ICell[][]) {
    super(width, height, cells);
    for (const terrain of Object.values(Terrain)) {
      this.terrainMap.set(terrain, new Set<ICell>());
    }
    for (const cell of this) {
      this.terrainMap.get(cell.terrain)?.add(cell);
      cell.onTerrainChange = (cell, oldTerrain, newTerrain) => {
        this.terrainMap.get(oldTerrain)?.delete(cell);
        this.terrainMap.get(newTerrain)?.add(cell);
      };
    }
  }

  /**
   * Iterates over cells matching a terrain type, invoking the callback with the cell and its coordinate.
   *
   * @param terrain Terrain type to filter cells by.
   * @param callback Callback invoked for each cell matching the terrain, along with its coordinate.
   */
  forEachTerrain(
    terrain: Terrain,
    callback: (cell: ICell, coordinate: ICoordinate) => void,
  ): void {
    this.terrainMap.get(terrain)?.forEach((cell) => {
      callback(cell, cell.coordinate);
    });
  }
}
