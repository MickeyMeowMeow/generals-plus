import type { Terrain } from "#/domain/cell/terrain";
import type { EffectTarget } from "#/domain/effect/effect-target";
import type { PlayerStatus } from "#/domain/player/player-status";
import type { IVisionModifier } from "#/domain/vision/interfaces";
import type { ICoordinate } from "#/math/coordinate";

export interface ICellOwner {
  readonly playerId: string;
  status: PlayerStatus;
}

/**
 * Represents a single cell on the grid, encapsulating its state and behavior.
 */
export interface ICell extends EffectTarget {
  /** Coordinate of the cell on the grid. */
  readonly coordinate: ICoordinate;

  /** Terrain type of the cell. */
  terrain: Terrain;

  /**
   * Whether the cell can be traversed or occupied.
   * Impassable cells always have null troops and no owner.
   */
  isPassable: boolean;

  /** Number of troops currently stationed on this cell, null if untouched or impassable. */
  troopCount: number | null;

  /** Owner of the cell, or null if unoccupied. */
  owner: ICellOwner | null;

  /** Vision modifier applied to this cell, affecting the sight radius of its owner. */
  vision: IVisionModifier;

  /** Triggered when the terrain changes, allowing external systems to react to this change. */
  onTerrianChange?: (
    cell: ICell,
    oldTerrian: Terrain,
    newTerrian: Terrain,
  ) => void;

  /**
   * Adds or removes troops from the cell.
   *
   * @param delta The number of troops to add (positive) or remove (negative).
   */
  addTroops(delta: number): void;
}
