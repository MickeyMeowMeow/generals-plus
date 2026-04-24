import type { ICell } from "@/domain/cell/interfaces";
import type { ICoordinate } from "@/math/coordinate";

export interface IGrid {
  /** Number of columns. */
  readonly width: number;
  /** Number of rows. */
  readonly height: number;

  /**
   * Retrieves the cell at the specified coordinate.
   *
   * @param coordinate - The coordinate of the cell to retrieve.
   * @returns The cell located at the given coordinate.
   */
  getCell(coordinate: ICoordinate): ICell;

  /**
   * Retrieves all valid neighboring cells of the specified coordinate.
   *
   * @param coordinate - The coordinate for which to find neighbors.
   * @returns An array of neighboring cells adjacent to the given coordinate.
   */
  getNeighbors(coordinate: ICoordinate): ICell[];
}
