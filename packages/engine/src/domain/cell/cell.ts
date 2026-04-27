import type { ICell, ICellOwner } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { EffectTarget } from "#/domain/effect/effect-target";
import type { IVisionModifier } from "#/domain/vision/interfaces";
import type { ICoordinate } from "#/math/coordinate";

/**
 * Construction data for a cell.
 * Defaults intentionally match the most neutral board state: plain, unowned, and unmodified vision.
 */
export interface CellOptions {
  /** Immutable location of the cell in the grid. */
  readonly coordinate: ICoordinate;
  /** Terrain determines passability and the base renderer color. */
  readonly terrain: Terrain;
  /** Current owner, if this cell has been captured. */
  readonly owner?: ICellOwner | null;
  /** Current troop count; null means the cell has no meaningful troop state yet. */
  readonly troopCount?: number | null;
  /** Vision radius contributed by this cell when owned. */
  readonly vision?: IVisionModifier;
}

/**
 * Concrete game cell used by generated maps and future simulation code.
 */
export class Cell extends EffectTarget implements ICell {
  /** Coordinate is fixed for the lifetime of a cell. */
  readonly coordinate: ICoordinate;
  terrain: Terrain;
  isPassable: boolean;
  troopCount: number | null;
  owner: ICellOwner | null;
  vision: IVisionModifier;

  /**
   * Creates a cell and derives passability/troop defaults from the terrain.
   */
  constructor(options: CellOptions) {
    super(`cell:${options.coordinate.x},${options.coordinate.y}`);

    this.coordinate = options.coordinate;
    this.terrain = options.terrain;
    this.isPassable =
      this.terrain !== Terrain.MOUNTAIN && this.terrain !== Terrain.VOID;
    this.owner = options.owner ?? null;
    this.troopCount = this.isPassable ? (options.troopCount ?? null) : 0;
    this.vision = options.vision ?? { radius: 1 };
  }

  /**
   * Applies a troop delta while keeping troop counts non-negative.
   * Impassable terrain ignores troop changes because it cannot be occupied.
   */
  addTroops(delta: number): void {
    if (!this.isPassable) {
      return;
    }

    this.troopCount = Math.max(0, (this.troopCount ?? 0) + delta);
  }
}
