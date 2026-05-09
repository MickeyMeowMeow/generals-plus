import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
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
  private readonly terrainMap: Map<Terrain, Set<ICell>> = new Map();

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
    for (const terrain of Object.values(Terrain)) {
      this.terrainMap.set(terrain, new Set<ICell>());
    }
    this.forEach((cell, _coordinate) => {
      this.terrainMap.get(cell.terrain)?.add(cell);
      cell.onTerrianChange = (cell, oldTerrain, newTerrain) => {
        this.terrainMap.get(oldTerrain)?.delete(cell);
        this.terrainMap.get(newTerrain)?.add(cell);
      };
    });
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

  /**
   * Iterates over cells matching a terrain type, invoking the callback with the cell and its coordinate.
   *
   * @param terrain Terrain type to filter cells by.
   * @param callback Callback invoked for each cell matching the terrain, along with its coordinate.
   */
  forEachTerrain(
    terrain: Terrain,
    callback: (cell: ICell, coordinate: ICoordinate) => void,
  ): void {
    this.terrainMap.get(terrain)?.forEach((cell) => {
      callback(cell, cell.coordinate);
    });
  }
}
