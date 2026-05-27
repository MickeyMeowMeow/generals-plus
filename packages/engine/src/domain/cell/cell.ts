import type { ICell, ICellOwner } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { EffectTarget } from "#/domain/effect/effect-target";
import type { IVisionModifier } from "#/domain/vision/interfaces";
import type { ICoordinate } from "#/math/coordinate";
import type { IItem } from "#/domain/item/interfaces";

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
  /** Index of the bomb site if this cell is a BOMB_SITE, null otherwise. */
  readonly siteIndex?: number | null;
  /** List of items currently residing in this cell. */
  readonly items?: IItem[];
}

/**
 * Concrete game cell used by generated maps and future simulation code.
 */
export class Cell extends EffectTarget implements ICell {
  /** Coordinate is fixed for the lifetime of a cell. */
  readonly coordinate: ICoordinate;
  private terrain_: Terrain;
  isPassable: boolean;
  troopCount: number | null;
  owner: ICellOwner | null;
  vision: IVisionModifier;
  siteIndex: number | null;
  readonly items: IItem[];
  onTerrainChange?: (
    cell: ICell,
    oldTerrain: Terrain,
    newTerrain: Terrain,
  ) => void;

  /**
   * Creates a cell and derives passability/troop defaults from the terrain.
   */
  constructor(options: CellOptions) {
    super();

    this.coordinate = options.coordinate;
    this.terrain_ = options.terrain;
    this.isPassable =
      this.terrain !== Terrain.MOUNTAIN && this.terrain !== Terrain.VOID;
    this.owner = options.owner ?? null;
    this.troopCount = this.isPassable ? (options.troopCount ?? null) : null;
    this.vision = options.vision ?? { radius: 1 };
    this.siteIndex = options.siteIndex ?? null;
    this.items = options.items ?? [];
  }

  get terrain() {
    return this.terrain_;
  }

  set terrain(newTerrain: Terrain) {
    this.onTerrainChange?.(this, this.terrain_, newTerrain);
    this.terrain_ = newTerrain;
    this.isPassable =
      this.terrain !== Terrain.MOUNTAIN && this.terrain !== Terrain.VOID;
    this.troopCount = this.isPassable ? this.troopCount : null;
    this.owner = this.isPassable ? this.owner : null;
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

