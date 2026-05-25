import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import type { EffectTarget } from "#/domain/effect/effect-target";
import type { IGrid } from "#/domain/grid/interfaces";
import type { ICoordinate } from "#/math/coordinate";
import {
  generateHexGridData,
  generateSquareGridData,
  HexGrid2D,
  SquareGrid2D,
} from "#/math/grid-2d";

export class SquareGrid
  extends SquareGrid2D<ICell>
  implements EffectTarget, IGrid
{
  private readonly terrainMap: Map<Terrain, Set<ICell>> = new Map();

  constructor(width: number, height: number, cells: ICell[][]) {
    super(width, height, cells);
    for (const terrain of Object.values(Terrain)) {
      this.terrainMap.set(terrain, new Set<ICell>());
    }
    for (const cell of this) {
      this.terrainMap.get(cell.terrain)?.add(cell);
      cell.onTerrainChange = (cell, oldTerrain, newTerrain) => {
        this.terrainMap.get(oldTerrain)?.delete(cell);
        this.terrainMap.get(newTerrain)?.add(cell);
      };
    }
  }

  static create(
    width: number,
    height: number,
    generator: (coord: ICoordinate) => ICell,
  ) {
    const cells = generateSquareGridData(width, height, generator);
    return new SquareGrid(width, height, cells);
  }

  forEachTerrain(
    terrain: Terrain,
    callback: (cell: ICell, coordinate: ICoordinate) => void,
  ): void {
    this.terrainMap.get(terrain)?.forEach((cell) => {
      callback(cell, cell.coordinate);
    });
  }
}

export class HexGrid extends HexGrid2D<ICell> implements EffectTarget, IGrid {
  private readonly terrainMap: Map<Terrain, Set<ICell>> = new Map();

  constructor(
    left: number,
    right: number,
    leftSlant: number,
    rightSlant: number,
    cells: ICell[][],
  ) {
    super(left, right, leftSlant, rightSlant, cells);
    for (const terrain of Object.values(Terrain)) {
      this.terrainMap.set(terrain, new Set<ICell>());
    }
    for (const cell of this) {
      this.terrainMap.get(cell.terrain)?.add(cell);
      cell.onTerrainChange = (cell, oldTerrain, newTerrain) => {
        this.terrainMap.get(oldTerrain)?.delete(cell);
        this.terrainMap.get(newTerrain)?.add(cell);
      };
    }
  }

  static create(
    left: number,
    right: number,
    leftSlant: number,
    rightSlant: number,
    generator: (coord: ICoordinate) => ICell,
  ) {
    const cells = generateHexGridData(
      left,
      right,
      leftSlant,
      rightSlant,
      generator,
    );
    return new HexGrid(left, right, leftSlant, rightSlant, cells);
  }

  forEachTerrain(
    terrain: Terrain,
    callback: (cell: ICell, coordinate: ICoordinate) => void,
  ): void {
    this.terrainMap.get(terrain)?.forEach((cell) => {
      callback(cell, cell.coordinate);
    });
  }
}

export type Grid = SquareGrid | HexGrid;
