import type { ICell } from "#/domain/cell/interfaces";
import { EffectTarget } from "#/domain/effect/effect-target";
import type { IGrid } from "#/domain/grid/interfaces";
import type { ICoordinate } from "#/math/coordinate";

/**
 * In-memory grid implementation backed by a row-major cell matrix.
 */
export class Grid extends EffectTarget implements IGrid {
  readonly width: number;
  readonly height: number;
  private readonly cells: ICell[][];

  /**
   * Creates a grid only when dimensions and the provided cell matrix agree.
   */
  constructor(width: number, height: number, cells: ICell[][]) {
    super(`grid:${width}x${height}`);

    if (width <= 0 || height <= 0) {
      throw new Error("Grid dimensions must be positive.");
    }

    if (cells.length !== height || cells.some((row) => row.length !== width)) {
      throw new Error(
        "Grid cell matrix does not match the requested dimensions.",
      );
    }

    this.width = width;
    this.height = height;
    this.cells = cells;
  }

  /**
   * Returns a cell when the coordinate is in bounds; otherwise null.
   */
  get(coordinate: ICoordinate): ICell | null {
    if (!this.isValid(coordinate)) {
      return null;
    }

    return this.cells[coordinate.y]?.[coordinate.x] ?? null;
  }

  /**
   * Returns valid orthogonal neighbors in reading-clockwise order.
   */
  getNeighbors(coordinate: ICoordinate): ICell[] {
    return [
      { x: coordinate.x, y: coordinate.y - 1 },
      { x: coordinate.x + 1, y: coordinate.y },
      { x: coordinate.x, y: coordinate.y + 1 },
      { x: coordinate.x - 1, y: coordinate.y },
    ].flatMap((neighbor) => {
      const cell = this.get(neighbor);
      return cell ? [cell] : [];
    });
  }

  /**
   * Checks whether a coordinate falls inside the rectangular grid bounds.
   */
  isValid(coordinate: ICoordinate): boolean {
    return (
      coordinate.x >= 0 &&
      coordinate.x < this.width &&
      coordinate.y >= 0 &&
      coordinate.y < this.height
    );
  }

  /**
   * Iterates over every cell from top-left to bottom-right.
   */
  forEach(callback: (element: ICell, coordinate: ICoordinate) => void): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        callback(this.cells[y][x], { x, y });
      }
    }
  }
}
