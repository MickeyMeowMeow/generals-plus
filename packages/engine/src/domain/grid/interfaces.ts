import type { ICell } from "#/domain/cell/interfaces";
import type { Terrain } from "#/domain/cell/terrain";
import type { EffectTarget } from "#/domain/effect/effect-target";
import type { ICoordinate } from "#/math/coordinate";
import type { GenericGrid2D } from "#/math/grid-2d";

export interface IGrid extends GenericGrid2D<ICell>, EffectTarget {
  /**
   * Iterates over cells matching a terrain type, invoking the callback with the cell and its coordinate.
   *
   * @param terrain Terrain type to filter cells by.
   * @param callback Callback invoked for each cell matching the terrain, along with its coordinate.
   */
  forEachTerrain(
    terrain: Terrain,
    callback: (cell: ICell, coordinate: ICoordinate) => void,
  ): void;
}
