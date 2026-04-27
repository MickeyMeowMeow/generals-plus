import type { ICoordinate } from "#math/coordinate";

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

/**
 * Base implementation of IGrid2D providing default behavior for common operations.
 */
export abstract class Grid2D<T> implements IGrid2D<T> {
  public readonly width: number;
  public readonly height: number;
  protected readonly gridData: T[][];

  constructor(width: number, height: number, gridData: T[][]) {
    this.width = width;
    this.height = height;
    this.gridData = gridData;
  }

  public get(coordinate: ICoordinate): T | null {
    if (!this.isValid(coordinate)) {
      return null;
    }
    return this.gridData[coordinate.y][coordinate.x];
  }

  public getNeighbors(coordinate: ICoordinate): T[] {
    const neighbors: T[] = [];
    const offsets = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];
    for (const offset of offsets) {
      const neighbor = this.get({ x: coordinate.x + offset.x, y: coordinate.y + offset.y });
      if (neighbor) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  public isValid(coordinate: ICoordinate): boolean {
    return (
      coordinate.x >= 0 &&
      coordinate.x < this.width &&
      coordinate.y >= 0 &&
      coordinate.y < this.height
    );
  }

  public forEach(callback: (element: T, coordinate: ICoordinate) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.get({ x, y });
        if (cell) {
          callback(cell, { x, y });
        }
      }
    }
  }
}
