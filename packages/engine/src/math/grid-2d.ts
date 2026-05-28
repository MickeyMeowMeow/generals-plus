import type { ICoordinate } from "#/math/coordinate";
import { getSquaredDistance } from "#/math/coordinate";

export const GridType = {
  SQUARE: "square",
  HEX: "hex",
} as const;

export type GridType = (typeof GridType)[keyof typeof GridType];

export interface GridBounds extends Record<GridType, Record<string, number>> {
  [GridType.SQUARE]: {
    /** Number of columns. */
    readonly width: number;
    /** Number of rows. */
    readonly height: number;
  };
  [GridType.HEX]: {
    /** Number of columns to the left of the center column (inclusive), used to calculate the minimum x coordinate. */
    readonly left: number;
    /** Number of columns to the right of the center column (inclusive), used to calculate the maximum x coordinate. */
    readonly right: number;
    /** Number of slanting rows from the center top to the lowest point, used to calculate the maximum y coordinate. */
    readonly leftSlant: number;
    /** Number of slanting rows from the center top to the lowest point, used to calculate the minimum z coordinate. */
    readonly rightSlant: number;
  };
}

export type GridShape = {
  [K in GridType]: { readonly gridType: K } & GridBounds[K];
}[GridType];

/**
 * A purely mathematical 2D spatial container.
 *
 * @template T The type of element stored in the grid.
 */
export interface GenericGrid2D<T, S extends GridType = GridType> {
  /** The type of grid (e.g., square, hex). */
  readonly gridType: S;

  /** The dimensions of the grid, which vary based on the grid type. */
  readonly bounds: GridBounds[S];

  /** The total number of cells in the grid. */
  get totalCells(): number;

  /** The Cartesian coordinates of the center of the grid, used for distance calculations. */
  get cartesianCenter(): ICoordinate;

  /**
   * Validates if a given coordinate exists within the grid boundaries.
   *
   * @param coordinate The coordinate to validate.
   * @returns True if the coordinate is valid, false otherwise.
   */
  isValid(coordinate: ICoordinate): boolean;

  /**
   * Transforms a grid coordinate to a zero-based array index.
   *
   * @param coordinate The grid coordinate to convert.
   * @returns The corresponding array index, or -1 if the coordinate is invalid.
   */
  toArrayIndex(coordinate: ICoordinate): number;

  /**
   * Converts a grid coordinate to Cartesian coordinates for rendering or other purposes.
   *
   * @param coordinate The grid coordinate to convert.
   * @returns The Cartesian coordinates corresponding to the given grid coordinate.
   */
  toCartesian(coordinate: ICoordinate): ICoordinate;

  /**
   * Converts Cartesian coordinates back to grid coordinates.
   *
   * @param coordinate The Cartesian coordinate to convert.
   * @returns The grid coordinates corresponding to the given Cartesian coordinate, or null if the Cartesian coordinate does not correspond to a valid grid cell.
   */
  fromCartesian(coordinate: ICoordinate): ICoordinate | null;

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
   * Calculates the squared Euclidean distance from the given coordinate to the center of the grid.
   *
   * @param coordinate The coordinate for which to calculate the distance to the center.
   *
   * @returns The distance to the center, or Infinity if the coordinate is invalid.
   */
  getDistanceToCenter(coordinate: ICoordinate): number;

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
  getNeighbors(coordinate: ICoordinate): [ICoordinate, T][];

  /**
   * Retrieves all valid coordinates within the grid, excluding a margin from the edges.
   *
   * @param margin The number of cells to exclude from the edges.
   * @returns An array of valid coordinates within the grid, excluding the margin.
   */
  getInteriorCoordinates(margin: number): ICoordinate[];

  /**
   * Iterates over every element in the grid.
   *
   * @param callback The function to execute for each element.
   */
  forEach(callback: (element: T, coordinate: ICoordinate) => void): void;

  /**
   * Iterates over all elements within a specified radius from a center coordinate, including the center itself.
   *
   * @param center The center coordinate from which to measure distance.
   * @param radius The radius within which to include elements, measured in Chebyshev distance.
   * @param callback The function to execute for each element within the radius, receiving the element and its coordinate.
   */
  forEachInRadius(
    center: ICoordinate,
    radius: number,
    callback: (element: T, coordinate: ICoordinate) => void,
  ): void;

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
  ): GenericGrid2D<U, S>;
}

/**
 * Base implementation of a square grid.
 */
export class SquareGrid2D<T>
  implements GenericGrid2D<T, typeof GridType.SQUARE>
{
  readonly gridType = GridType.SQUARE;
  readonly bounds: GridBounds[typeof GridType.SQUARE];
  readonly gridData: T[][];

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

    this.bounds = { width, height };
    this.gridData = gridData;
  }

  static generate<T>(
    width: number,
    height: number,
    generator: (coordinate: ICoordinate) => T,
  ): SquareGrid2D<T> {
    const gridData = generateSquareGridData(width, height, generator);
    return new SquareGrid2D(width, height, gridData);
  }

  static fromArray<T, G>(
    width: number,
    height: number,
    array: T[],
    callback: (element: T, coordinate: ICoordinate) => G,
  ): SquareGrid2D<G> {
    const gridData = createSquareGridDataFromArray(
      width,
      height,
      array,
      callback,
    );
    return new SquareGrid2D(width, height, gridData);
  }

  get width(): number {
    return this.bounds.width;
  }

  get height(): number {
    return this.bounds.height;
  }

  get totalCells(): number {
    return this.width * this.height;
  }

  get cartesianCenter(): ICoordinate {
    return this.toCartesian({
      x: (this.width - 1) / 2,
      y: (this.height - 1) / 2,
    });
  }

  isValid(coordinate: ICoordinate): boolean {
    return (
      coordinate.x >= 0 &&
      coordinate.x < this.width &&
      coordinate.y >= 0 &&
      coordinate.y < this.height
    );
  }

  toArrayIndex(coordinate: ICoordinate): number {
    if (!this.isValid(coordinate)) {
      return -1;
    }

    return coordinate.y * this.width + coordinate.x;
  }

  toCartesian(coordinate: ICoordinate): ICoordinate {
    return { x: coordinate.x, y: coordinate.y };
  }

  fromCartesian(coordinate: ICoordinate): ICoordinate | null {
    const x = Math.round(coordinate.x);
    const y = Math.round(coordinate.y);
    return this.isValid({ x, y }) ? { x, y } : null;
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

  getDistanceToCenter(coordinate: ICoordinate): number {
    if (!this.isValid(coordinate)) {
      return Infinity;
    }
    return getSquaredDistance(
      this.cartesianCenter,
      this.toCartesian(coordinate),
    );
  }

  isAdjacent(coord1: ICoordinate, coord2: ICoordinate): boolean {
    if (!this.isValid(coord1) || !this.isValid(coord2)) {
      return false;
    }
    return this.getDistance(coord1, coord2) === 1;
  }

  getNeighbors(coordinate: ICoordinate): [ICoordinate, T][] {
    const neighbors: [ICoordinate, T][] = [];
    const offsets = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    for (const offset of offsets) {
      const coord = { x: coordinate.x + offset.x, y: coordinate.y + offset.y };
      const neighbor = this.get(coord);
      if (neighbor !== null) {
        neighbors.push([coord, neighbor]);
      }
    }
    return neighbors;
  }

  getInteriorCoordinates(margin: number): ICoordinate[] {
    const coordinates: ICoordinate[] = [];
    for (let y = margin; y < this.height - margin; y++) {
      for (let x = margin; x < this.width - margin; x++) {
        coordinates.push({ x, y });
      }
    }
    return coordinates;
  }

  forEach(callback: (element: T, coordinate: ICoordinate) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        callback(this.gridData[y][x], { x, y });
      }
    }
  }

  forEachInRadius(
    center: ICoordinate,
    radius: number,
    callback: (element: T, coordinate: ICoordinate) => void,
  ): void {
    const minX = Math.max(0, center.x - radius);
    const maxX = Math.min(this.width - 1, center.x + radius);
    const minY = Math.max(0, center.y - radius);
    const maxY = Math.min(this.height - 1, center.y + radius);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
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
export class HexGrid2D<T> implements GenericGrid2D<T, typeof GridType.HEX> {
  readonly gridType = GridType.HEX;
  readonly bounds: GridBounds[typeof GridType.HEX];
  readonly gridData: T[][];

  /**
   * Calculates the minimum x coordinate for a given y coordinate based on the left slant.
   *
   * @param y The y coordinate for which to calculate the minimum x coordinate.
   * @param left The number of columns to the left of the center column.
   *
   * @return The minimum x coordinate for the given y coordinate.
   */
  static getMinX(y: number, left: number): number {
    return Math.max(-left + 1, -y);
  }

  /**
   * Calculates the maximum x coordinate for a given y coordinate based on the right slant.
   *
   * @param y The y coordinate for which to calculate the maximum x coordinate.
   * @param right The number of columns to the right of the center column.
   * @param rightSlant The number of slanting rows from the center top to the lowest point on the right side.
   *
   * @return The maximum x coordinate for the given y coordinate.
   */
  static getMaxX(y: number, right: number, rightSlant: number): number {
    return Math.min(right - 1, rightSlant - y - 1);
  }

  static generate<T>(
    left: number,
    right: number,
    leftSlant: number,
    rightSlant: number,
    generator: (coordinate: ICoordinate) => T,
  ): HexGrid2D<T> {
    const gridData = generateHexGridData(
      left,
      right,
      leftSlant,
      rightSlant,
      generator,
    );
    return new HexGrid2D(left, right, leftSlant, rightSlant, gridData);
  }

  static fromArray<T, G>(
    left: number,
    right: number,
    leftSlant: number,
    rightSlant: number,
    array: T[],
    callback: (element: T, coordinate: ICoordinate) => G,
  ): HexGrid2D<G> {
    const gridData = createHexGridDataFromArray(
      left,
      right,
      leftSlant,
      rightSlant,
      array,
      callback,
    );
    return new HexGrid2D(left, right, leftSlant, rightSlant, gridData);
  }

  get left(): number {
    return this.bounds.left;
  }

  get right(): number {
    return this.bounds.right;
  }

  get leftSlant(): number {
    return this.bounds.leftSlant;
  }

  get rightSlant(): number {
    return this.bounds.rightSlant;
  }

  private getMinX(y: number): number {
    return HexGrid2D.getMinX(y, this.left);
  }

  private getMaxX(y: number): number {
    return HexGrid2D.getMaxX(y, this.right, this.rightSlant);
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

    this.bounds = { left, right, leftSlant, rightSlant };

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

  get totalCells(): number {
    const maxY = this.leftSlant - 1;
    return this.toArrayIndex({ x: this.getMaxX(maxY), y: maxY }) + 1;
  }

  get cartesianCenter(): ICoordinate {
    const centerY = (this.leftSlant - 1) / 2;
    const centerX = (this.getMinX(centerY) + this.getMaxX(centerY)) / 2;
    return this.toCartesian({ x: centerX, y: centerY });
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

  toArrayIndex({ x, y }: ICoordinate): number {
    if (!this.isValid({ x, y })) {
      return -1;
    }

    const leftCells =
      y <= this.left
        ? ((y - 1) * y) / 2
        : (this.left - 1) * (y - this.left / 2);
    const rightCells =
      y - 1 <= this.rightSlant - this.right
        ? this.right * y
        : this.right * y -
          ((y - this.rightSlant + this.right) *
            (y - this.rightSlant + this.right - 1)) /
            2;
    return leftCells + rightCells + x - this.getMinX(y);
  }

  private static readonly SQRT3_OVER_3 = Math.sqrt(3) / 3;

  toCartesian(coordinate: ICoordinate): { x: number; y: number } {
    return {
      x: coordinate.x,
      y: (coordinate.y * 2 + coordinate.x) * HexGrid2D.SQRT3_OVER_3,
    };
  }

  fromCartesian(coordinate: ICoordinate): ICoordinate | null {
    const fx = coordinate.x;
    const fy = (coordinate.y / HexGrid2D.SQRT3_OVER_3 - fx) / 2;
    const fz = -fx - fy;

    let rx = Math.round(fx);
    let ry = Math.round(fy);
    const rz = Math.round(fz);

    // Calculate differences to determine which axis had the most rounding error
    const dx = Math.abs(rx - fx);
    const dy = Math.abs(ry - fy);
    const dz = Math.abs(rz - fz);

    // Adjust the coordinate with the largest error to satisfy x + y + z = 0
    if (dx > dy && dx > dz) {
      rx = -ry - rz;
    } else if (dy > dz) {
      ry = -rx - rz;
    }

    const candidate: ICoordinate = { x: rx, y: ry };
    return this.isValid(candidate) ? candidate : null;
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

  getDistanceToCenter(coordinate: ICoordinate): number {
    if (!this.isValid(coordinate)) {
      return Infinity;
    }
    return getSquaredDistance(
      this.cartesianCenter,
      this.toCartesian(coordinate),
    );
  }

  isAdjacent(coord1: ICoordinate, coord2: ICoordinate): boolean {
    if (!this.isValid(coord1) || !this.isValid(coord2)) {
      return false;
    }
    return this.getDistance(coord1, coord2) === 1;
  }

  getNeighbors(coordinate: ICoordinate): [ICoordinate, T][] {
    const neighbors: [ICoordinate, T][] = [];
    const offsets = [
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
    ];
    for (const offset of offsets) {
      const coord = { x: coordinate.x + offset.x, y: coordinate.y + offset.y };
      const neighbor = this.get(coord);
      if (neighbor !== null) {
        neighbors.push([coord, neighbor]);
      }
    }
    return neighbors;
  }

  getInteriorCoordinates(margin: number): ICoordinate[] {
    const coordinates: ICoordinate[] = [];
    for (let y = margin; y < this.leftSlant - margin; y++) {
      const minX = this.getMinX(y) + margin;
      const maxX = this.getMaxX(y) - margin;
      for (let x = minX; x <= maxX; x++) {
        coordinates.push({ x, y });
      }
    }
    return coordinates;
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

  forEachInRadius(
    center: ICoordinate,
    radius: number,
    callback: (element: T, coordinate: ICoordinate) => void,
  ): void {
    const minY = Math.max(0, center.y - radius);
    const maxY = Math.min(this.leftSlant - 1, center.y + radius);
    for (let y = minY; y <= maxY; y++) {
      const minX = Math.max(
        this.getMinX(y),
        center.x - radius + Math.max(0, center.y - y),
      );
      const maxX = Math.min(
        this.getMaxX(y),
        center.x + radius - Math.max(0, y - center.y),
      );
      for (let x = minX; x <= maxX; x++) {
        callback(this.gridData[y][x - this.getMinX(y)], { x, y });
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

export function generateSquareGridData<T>(
  width: number,
  height: number,
  generator: (coordinate: ICoordinate) => T,
): T[][] {
  if (width <= 0 || height <= 0) {
    throw new Error("Grid dimensions must be positive.");
  }

  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => generator({ x, y })),
  );
}

export function generateHexGridData<T>(
  left: number,
  right: number,
  leftSlant: number,
  rightSlant: number,
  generator: (coordinate: ICoordinate) => T,
): T[][] {
  if (left <= 0 || right <= 0 || leftSlant <= 0 || rightSlant <= 0) {
    throw new Error("Grid dimensions must be positive.");
  }

  return Array.from({ length: leftSlant }, (_, y) => {
    const minX = HexGrid2D.getMinX(y, left);
    const maxX = HexGrid2D.getMaxX(y, right, rightSlant);
    return Array.from({ length: maxX - minX + 1 }, (_, x) =>
      generator({ x: x + minX, y }),
    );
  });
}

export function createSquareGridDataFromArray<T, G>(
  width: number,
  height: number,
  array: T[],
  callback: (element: T, coordinate: ICoordinate) => G,
): G[][] {
  if (width <= 0 || height <= 0) {
    throw new Error("Grid dimensions must be positive.");
  }

  if (array.length !== width * height) {
    throw new Error("Array length does not match grid dimensions.");
  }

  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      callback(array[y * width + x], { x, y }),
    ),
  );
}

export function createHexGridDataFromArray<T, G>(
  left: number,
  right: number,
  leftSlant: number,
  rightSlant: number,
  array: T[],
  callback: (element: T, coordinate: ICoordinate) => G,
): G[][] {
  if (left <= 0 || right <= 0 || leftSlant <= 0 || rightSlant <= 0) {
    throw new Error("Grid dimensions must be positive.");
  }

  const gridData: G[][] = [];
  let currentLength = 0;
  for (let y = 0; y < leftSlant; y++) {
    const minX = HexGrid2D.getMinX(y, left);
    const maxX = HexGrid2D.getMaxX(y, right, rightSlant);
    if (array.length < currentLength + maxX - minX + 1) {
      throw new Error("Array length does not match grid dimensions.");
    }
    gridData[y] = [];
    for (let x = minX; x <= maxX; x++) {
      const element = array[currentLength + x - minX];
      gridData[y].push(callback(element, { x, y }));
    }
    currentLength += maxX - minX + 1;
  }

  if (array.length !== currentLength) {
    throw new Error("Array length does not match grid dimensions.");
  }

  return gridData;
}
