import type { ICellOwner } from "@/domain/cell/interfaces";
import type { Terrain } from "@/domain/cell/terrain";
import type { Visibility } from "@/domain/vision/visibility";
import type { ICoordinate } from "@/math/coordinate";
import type { IGrid2D } from "@/math/grid-2d";

/**
 * Represents a terrain type that is partially obscured by the fog of war.
 * Used when visibility is `SHROUDED`, indicating uncertainty about the exact terrain type.
 */
export const MaskedTerrain = {
  MAYBE_PLAIN: "maybe_plain",
  MAYBE_MOUNTAIN: "maybe_mountain",
} as const;
export type MaskedTerrain = (typeof MaskedTerrain)[keyof typeof MaskedTerrain];

/** Represents the perceived terrain of a cell based on its visibility state. */
export type VisionTerrain = Terrain | MaskedTerrain | null;

/**
 * Represents a single cell as perceived through the fog of war.
 * All dynamic or hidden properties are strictly nullable based on the visibility state.
 */
export interface IVisionCell {
  readonly coordinate: ICoordinate;
  readonly visibility: Visibility;

  /**
   * The perceived terrain type of the cell.
   * Null if `HIDDEN`, masked if `SHROUDED`, and accurate if `VISIBLE`.
   */
  readonly terrain: VisionTerrain;

  /**
   * The perceived number of troops.
   * Null if untouched, impassable, or if visibility is strictly less than `VISIBLE`.
   */
  readonly troopCount: number | null;

  /**
   * The perceived owner of the cell.
   * Null if unoccupied or if visibility is strictly less than `VISIBLE`.
   */
  readonly owner: ICellOwner | null;
}

/**
 * Represents the entire grid as perceived through the fog of war.
 */
export interface IVisionGrid extends IGrid2D<IVisionCell> {}
