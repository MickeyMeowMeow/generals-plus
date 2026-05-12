import type { ICell } from "#/domain/cell/interfaces";
import type { Terrain } from "#/domain/cell/terrain";
import type { EffectTarget } from "#/domain/effect/effect-target";
import type { ICoordinate } from "#/math/coordinate";
import type { IGrid2D } from "#/math/grid-2d";

export interface IGrid extends IGrid2D<ICell>, EffectTarget {
  forEachTerrain(
    terrain: Terrain,
    callback: (cell: ICell, coordinate: ICoordinate) => void,
  ): void;
}
