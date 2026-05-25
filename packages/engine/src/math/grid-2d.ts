import type { ICoordinate } from "#/math/coordinate";

export const GridType = {
  SQUARE: "square",
  HEX: "hex",
} as const;

export type GridType = (typeof GridType)[keyof typeof GridType];

/**
 * A purely mathematical 2D spatial container.
 *
 * @template T The type of element stored in the grid.
 */
export interface GenericGrid2D<T> {
  /** The type of grid (e.g., square, hex). */
  readonly gridType: GridType;

  /**
   * Validates if a given coordinate exists within the grid boundaries.
   *
   * @param coordinate The coordinate to validate.
   * @returns True if the coordinate is valid, false otherwise.
   */
  isValid(coordinate: ICoordinate): boolean;

  /**
   * Retrieves the element at the given coordinate.
   *
   * @param coordinate The coordinate of the element to retrieve.
   * @returns The element, or null if the coordinate is out of bounds.
   */
  get(coordinate: ICoordinate): T | null;

  /**
   * Sets the element at the given coordinate.
   *
   * @param coordinate The coordinate of the element to set.
   * @param value The value to set at the coordinate.
   */
  set(coordinate: ICoordinate, value: T): void;

  /**
   * Calculates the Manhattan distance between two coordinates.
   *
   * @param coord1 The first coordinate.
   * @param coord2 The second coordinate.
   *
   * @returns The Manhattan distance, or Infinity if either coordinate is invalid.
   */
  getDistance(coord1: ICoordinate, coord2: ICoordinate): number;

  /**
   * Checks if two coordinates are adjacent in the grid.
   *
   * @param coord1 The first coordinate.
   * @param coord2 The second coordinate.
   *
   * @returns True if the coordinates are valid and adjacent, false otherwise.
   */
  isAdjacent(coord1: ICoordinate, coord2: ICoordinate): boolean;

  /**
   * Retrieves all valid neighbors in clockwise order starting from the top, filtering out any that are out of bounds.
   *
   * @param coordinate The center location.
   * @returns An array of adjacent, valid elements.
   */
  getNeighbors(coordinate: ICoordinate): T[];

  /**
   * Iterates over every element in the grid.
   *
   * @param callback The function to execute for each element.
   */
  forEach(callback: (element: T, coordinate: ICoordinate) => void): void;

  [Symbol.iterator](): IterableIterator<T>;

  /**
   * @returns An iterator of [ICoordinate, T] pairs for each cell in the grid.
   */
  entries(): IterableIterator<[ICoordinate, T]>;

  /**
   * Maps each element in the grid to a new value, returning a new Grid2D with the same dimensions.
   *
   * @param callback The function to apply to each element, receiving the element and its coordinate.
   * @returns A new Grid2D containing the mapped values.
   */
  map<U>(
    callback: (element: T, coordinate: ICoordinate) => U,
  ): GenericGrid2D<U>;
}

/**
 * Base implementation of a square grid.
 */
export class SquareGrid2D<T> implements GenericGrid2D<T> {
  readonly gridType = GridType.SQUARE;

  /** Number of columns. */
  readonly width: number;
  /** Number of rows. */
  readonly height: number;

  protected readonly gridData: T[][];

  constructor(width: number, height: number, gridData: T[][]) {
    if (width <= 0 || height <= 0) {
      throw new Error("Grid dimensions must be positive.");
    }

    if (
      gridData.length !== height ||
      gridData.some((row) => row.length !== width)
    ) {
      throw new Error("Grid data does not match the specified dimensions.");
    }

    this.width = width;
    this.height = height;
    this.gridData = gridData;
  }

  isValid(coordinate: ICoordinate): boolean {
    return (
      coordinate.x >= 0 &&
      coordinate.x < this.width &&
      coordinate.y >= 0 &&
      coordinate.y < this.height
    );
  }

  get(coordinate: ICoordinate): T | null {
    if (!this.isValid(coordinate)) {
      return null;
    }
    return this.gridData[coordinate.y][coordinate.x];
  }

  set(coordinate: ICoordinate, value: T): void {
    if (this.isValid(coordinate)) {
      this.gridData[coordinate.y][coordinate.x] = value;
    }
  }

  getDistance(coord1: ICoordinate, coord2: ICoordinate): number {
    if (!this.isValid(coord1) || !this.isValid(coord2)) {
      return Infinity;
    }
    return Math.abs(coord1.x - coord2.x) + Math.abs(coord1.y - coord2.y);
  }

  isAdjacent(coord1: ICoordinate, coord2: ICoordinate): boolean {
    if (!this.isValid(coord1) || !this.isValid(coord2)) {
      return false;
    }
    return this.getDistance(coord1, coord2) === 1;
  }

  getNeighbors(coordinate: ICoordinate): T[] {
    const neighbors: T[] = [];
    const offsets = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    for (const offset of offsets) {
      const neighbor = this.get({
        x: coordinate.x + offset.x,
        y: coordinate.y + offset.y,
      });
      if (neighbor !== null) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  forEach(callback: (element: T, coordinate: ICoordinate) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        callback(this.gridData[y][x], { x, y });
      }
    }
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        yield this.gridData[y][x];
      }
    }
  }

  *entries(): IterableIterator<[ICoordinate, T]> {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        yield [{ x, y }, this.gridData[y][x]];
      }
    }
  }

  map<U>(
    callback: (element: T, coordinate: ICoordinate) => U,
  ): SquareGrid2D<U> {
    const newGridData: U[][] = this.gridData.map((row, y) =>
      row.map((element, x) => callback(element, { x, y })),
    );
    return new SquareGrid2D<U>(this.width, this.height, newGridData);
  }
}

/*
 * Base implementation of a hexagonal grid.
 * The axial coordinate system is used, where the top cell is (0, 0), x increases to the right, and y increases along the left slant downwards.
 * The grid is defined by the number of columns to the left and right of the center column, and the number of slanting rows from the center top to the lowest point on each side.
 */
export class HexGrid2D<T> implements GenericGrid2D<T> {
  readonly gridType = GridType.HEX;

  /** Number of columns to the left of the center column (inclusive), used to calculate the minimum x coordinate. */
  readonly left: number;
  /** Number of columns to the right of the center column (inclusive), used to calculate the maximum x coordinate. */
  readonly right: number;
  /** Number of slanting rows from the center top to the lowest point, used to calculate the maximum y coordinate. */
  readonly leftSlant: number;
  /** Number of slanting rows from the center top to the lowest point, used to calculate the minimum z coordinate. */
  readonly rightSlant: number;

  protected readonly gridData: T[][];

  /**
   * Calculates the minimum x coordinate for a given y coordinate based on the left slant.
   *
   * @param y The y coordinate for which to calculate the minimum x coordinate.
   * @return The minimum x coordinate for the given y coordinate.
   */
  private getMinX(y: number): number {
    return Math.max(-this.left + 1, -y);
  }

  /**
   * Calculates the maximum x coordinate for a given y coordinate based on the right slant.
   *
   * @param y The y coordinate for which to calculate the maximum x coordinate.
   * @return The maximum x coordinate for the given y coordinate.
   */
  private getMaxX(y: number): number {
    return Math.min(this.right - 1, this.rightSlant - y - 1);
  }

  constructor(
    left: number,
    right: number,
    leftSlant: number,
    rightSlant: number,
    gridData: T[][],
  ) {
    if (left <= 0 || right <= 0 || leftSlant <= 0 || rightSlant <= 0) {
      throw new Error("Grid dimensions must be positive.");
    }

    this.left = left;
    this.right = right;
    this.leftSlant = leftSlant;
    this.rightSlant = rightSlant;

    if (
      gridData.length !== leftSlant ||
      gridData.some(
        (row, y) => row.length !== this.getMaxX(y) - this.getMinX(y) + 1,
      )
    ) {
      throw new Error("Grid data does not match the specified dimensions.");
    }

    this.gridData = gridData;
  }

  isValid(coordinate: ICoordinate): boolean {
    if (coordinate.y < 0 || coordinate.y >= this.leftSlant) {
      return false;
    }
    return (
      coordinate.x >= this.getMinX(coordinate.y) &&
      coordinate.x <= this.getMaxX(coordinate.y)
    );
  }

  get(coordinate: ICoordinate): T | null {
    if (!this.isValid(coordinate)) {
      return null;
    }
    const minX = this.getMinX(coordinate.y);
    return this.gridData[coordinate.y][coordinate.x - minX];
  }

  set(coordinate: ICoordinate, value: T): void {
    if (this.isValid(coordinate)) {
      const minX = this.getMinX(coordinate.y);
      this.gridData[coordinate.y][coordinate.x - minX] = value;
    }
  }

  getDistance(coord1: ICoordinate, coord2: ICoordinate): number {
    if (!this.isValid(coord1) || !this.isValid(coord2)) {
      return Infinity;
    }
    const dx = coord1.x - coord2.x;
    const dy = coord1.y - coord2.y;
    return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
  }

  isAdjacent(coord1: ICoordinate, coord2: ICoordinate): boolean {
    if (!this.isValid(coord1) || !this.isValid(coord2)) {
      return false;
    }
    return this.getDistance(coord1, coord2) === 1;
  }

  getNeighbors(coordinate: ICoordinate): T[] {
    const neighbors: T[] = [];
    const offsets = [
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
    ];
    for (const offset of offsets) {
      const neighbor = this.get({
        x: coordinate.x + offset.x,
        y: coordinate.y + offset.y,
      });
      if (neighbor !== null) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  forEach(callback: (element: T, coordinate: ICoordinate) => void): void {
    for (let y = 0; y < this.leftSlant; y++) {
      const minX = this.getMinX(y);
      const maxX = this.getMaxX(y);
      for (let x = minX; x <= maxX; x++) {
        callback(this.gridData[y][x - minX], { x, y });
      }
    }
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (let y = 0; y < this.leftSlant; y++) {
      const minX = this.getMinX(y);
      const maxX = this.getMaxX(y);
      for (let x = minX; x <= maxX; x++) {
        yield this.gridData[y][x - minX];
      }
    }
  }

  *entries(): IterableIterator<[ICoordinate, T]> {
    for (let y = 0; y < this.leftSlant; y++) {
      const minX = this.getMinX(y);
      const maxX = this.getMaxX(y);
      for (let x = minX; x <= maxX; x++) {
        yield [{ x, y }, this.gridData[y][x - minX]];
      }
    }
  }

  map<U>(callback: (element: T, coordinate: ICoordinate) => U): HexGrid2D<U> {
    const newGridData: U[][] = this.gridData.map((row, y) => {
      const minX = this.getMinX(y);
      return row.map((element, x) => callback(element, { x: x + minX, y }));
    });
    return new HexGrid2D<U>(
      this.left,
      this.right,
      this.leftSlant,
      this.rightSlant,
      newGridData,
    );
  }
}
