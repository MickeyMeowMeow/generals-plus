import type { CellState } from "@/domain/cell/cell-state";
import type { ITerrainProperties } from "@/domain/terrain/terrain-property";

/**
 * Represents a single cell on the grid, encapsulating its state and behavior.
 */
export interface ICell {
  /** Underlying state of the cell. */
  readonly state: CellState;

  /** Terrain properties that define the cell's behavior and interactions. */
  readonly properties: ITerrainProperties;
}
