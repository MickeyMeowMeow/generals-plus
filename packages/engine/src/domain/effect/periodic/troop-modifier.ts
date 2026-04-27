import type { EffectTarget } from "#/domain/effect/effect-target";
import type { EffectType } from "#/domain/effect/effect-type";
import type { PeriodicEffectOptions } from "#/domain/effect/periodic/periodic-effect";
import { PeriodicEffect } from "#/domain/effect/periodic/periodic-effect";

interface TroopCarrierTarget extends EffectTarget {
  addTroops(delta: number): void;
}

export interface TroopModifierEffectOptions
  extends PeriodicEffectOptions<TroopCarrierTarget> {
  type: typeof EffectType.TROOP_GENERATION | typeof EffectType.TROOP_DRAIN;
  target: TroopCarrierTarget;

  /**
   * Number of troops to generate or drain. Positive for generation, negative for drain.
   */
  delta: number;
}

/**
 * Effect that increments or decrements the number of troops on a target at regular intervals.
 */
export class TroopModifierEffect extends PeriodicEffect<TroopCarrierTarget> {
  delta: number;

  constructor(currentTick: number, options: TroopModifierEffectOptions) {
    super(currentTick, options);
    this.delta = options.delta;
  }

  trigger(currentTick: number): void {
    this.target.addTroops(this.delta);
    super.trigger(currentTick);
  }
}
