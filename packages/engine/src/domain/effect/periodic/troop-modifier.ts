import type { ICellOwner } from "#/domain/cell/interfaces";
import type { Terrain } from "#/domain/cell/terrain";
import type { EffectTarget } from "#/domain/effect/effect-target";
import type { EffectType } from "#/domain/effect/effect-type";
import type { PeriodicEffectOptions } from "#/domain/effect/periodic/periodic-effect";
import { PeriodicEffect } from "#/domain/effect/periodic/periodic-effect";
import { PlayerStatus } from "#/domain/player/player-status";
import type { ICoordinate } from "#/math/coordinate";
import type { GenericGrid2D } from "#/math/grid-2d";

interface TroopCarrierCell {
  owner: ICellOwner | null;
  addTroops(delta: number): void;
}

interface TroopModifierGrid
  extends EffectTarget,
    GenericGrid2D<TroopCarrierCell> {
  forEachTerrain(
    terrain: Terrain,
    callback: (cell: TroopCarrierCell, coordinate: ICoordinate) => void,
  ): void;
}

export interface TroopModifierEffectOptions
  extends PeriodicEffectOptions<TroopModifierGrid> {
  type: typeof EffectType.TROOP_GENERATION | typeof EffectType.TROOP_DRAIN;
  target: TroopModifierGrid;

  /**
   * Terrain type that determines which cells are affected by the effect.
   * Only cells with this terrain type will have their troops modified.
   */
  terrain: Terrain;

  /**
   * Number of troops to generate or drain. Positive for generation, negative for drain.
   */
  delta: number;

  /**
   * If set, only cells owned by players whose IDs are in this set are affected.
   * Useful for targeting specific players (e.g., mother zombie troop boost).
   */
  ownerPlayerIds?: ReadonlySet<string>;
}

/**
 * Effect that increments or decrements the number of troops on cells with a specific terrain type at regular intervals.
 */
export class TroopModifierEffect extends PeriodicEffect<TroopModifierGrid> {
  readonly terrain: Terrain;
  readonly delta: number;
  private readonly ownerPlayerIds?: ReadonlySet<string>;

  constructor(currentTick: number, options: TroopModifierEffectOptions) {
    super(currentTick, options);
    this.terrain = options.terrain;
    this.delta = options.delta;
    this.ownerPlayerIds = options.ownerPlayerIds;
  }

  trigger(currentTick: number): void {
    this.target.forEachTerrain(this.terrain, (cell) => {
      if (cell.owner?.status === PlayerStatus.ACTIVE) {
        if (
          this.ownerPlayerIds &&
          !this.ownerPlayerIds.has(cell.owner.playerId)
        ) {
          return;
        }
        cell.addTroops(this.delta);
      }
    });
    super.trigger(currentTick);
  }
}
