import type { TerrainType } from "@/domain/terrain/terrain-type";
import type { ICoordinate } from "@/math/coordinate";

/**
 * Common properties for all cell types.
 */
export interface IBaseCellState {
  /** Coordinate of the cell on the grid. */
  readonly coordinate: ICoordinate;
  /** Terrain type of the cell. */
  readonly terrain: TerrainType;
}

/**
 * Properties specific to impassable cells.
 * These cells cannot be occupied or traversed.
 */
export interface IImpassableCellState extends IBaseCellState {
  readonly terrain: typeof TerrainType.MOUNTAIN;
}

/**
 * Properties specific to passable cells.
 * These cells can be traversed but may not be occupied on them.
 */
export interface IPassibleCellState extends IBaseCellState {
  readonly terrain:
    | typeof TerrainType.PLAIN
    | typeof TerrainType.GENERAL
    | typeof TerrainType.SWAMP
    | typeof TerrainType.DESERT
    | typeof TerrainType.CITY;
}

/**
 * Properties specific to occupiable cells.
 * These cells can be occupied by players and have troops stationed on them.
 */
export interface IOccupiableCellState extends IPassibleCellState {
  readonly terrain:
    | typeof TerrainType.PLAIN
    | typeof TerrainType.GENERAL
    | typeof TerrainType.SWAMP
    | typeof TerrainType.DESERT
    | typeof TerrainType.CITY;
  /** ID of the player who owns this cell, or null if unoccupied. */
  owner: string | null;
  /** Number of troops currently stationed on this cell. */
  troopCount: number;
}

/**
 * Properties specific to cells that have a time-based effect on its troop count.
 * These cells generate or drain troops at a regular interval based on their terrain type.
 */
export interface ITickingCellState extends IOccupiableCellState {
  readonly terrain: typeof TerrainType.GENERAL | typeof TerrainType.CITY;
  /** Ticks remaining until the next troop generation or drain occurs. */
  tickProgress: number;
}

export type CellState =
  | IImpassableCellState
  | IOccupiableCellState
  | ITickingCellState;
