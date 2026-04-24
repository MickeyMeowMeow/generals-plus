import type { ICoordinate } from "@/math/coordinate";

/**
 * A purely mathematical 2D spatial container.
 * Agnostic to game logic, handling only bounds, indices, and iterations.
 *
 * @template T - The type of element stored in the grid.
 */
export interface IGrid2D<T> {
  /** Number of columns. */
  readonly width: number;
  /** Number of rows. */
  readonly height: number;

  /**
   * Retrieves the element at the given coordinate.
   *
   * @param coordinate - The coordinate of the element to retrieve.
   * @returns The element, or null if the coordinate is out of bounds.
   */
  get(coordinate: ICoordinate): T | null;

  /**
   * Retrieves all valid orthogonal neighbors (Up, Down, Left, Right), filtering out any that are out of bounds.
   *
   * @param coordinate - The center location.
   * @returns An array of adjacent, valid elements.
   */
  getNeighbors(coordinate: ICoordinate): T[];

  /**
   * Validates if a given coordinate exists within the grid boundaries.
   *
   * @param coordinate - The location to check.
   * @returns True if within [0, width-1] and [0, height-1].
   */
  isValid(coordinate: ICoordinate): boolean;

  /**
   * Iterates over every element in the grid.
   *
   * @param callback - The function to execute for each element.
   */
  forEach(callback: (element: T, coordinate: ICoordinate) => void): void;
}
