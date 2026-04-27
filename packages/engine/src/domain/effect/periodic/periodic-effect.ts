import type { EffectOptions } from "#/domain/effect/effect";
import { Effect } from "#/domain/effect/effect";
import type { EffectTarget } from "#/domain/effect/effect-target";
import type { EffectType } from "#/domain/effect/effect-type";

export interface PeriodicEffectOptions<TTarget extends EffectTarget>
  extends EffectOptions<TTarget> {
  type: typeof EffectType.TROOP_GENERATION | typeof EffectType.TROOP_DRAIN;

  /**
   * Interval in ticks at which the effect will be triggered.
   */
  interval: number;
}

/**
 * Base class for effects that trigger at regular intervals.
 */
export abstract class PeriodicEffect<
  TTarget extends EffectTarget = EffectTarget,
> extends Effect<TTarget> {
  readonly interval: number;

  /**
   * Tick at which the effect will be triggered next.
   */
  triggerAt: number;

  constructor(currentTick: number, options: PeriodicEffectOptions<TTarget>) {
    super(currentTick, options);
    this.interval = options.interval;
    this.triggerAt = currentTick + this.interval;
  }

  /**
   * Triggers the effect, called when the current tick reaches the `triggerAt` tick.
   * Automatically schedules the next trigger by updating the `triggerAt` property based on the defined interval.
   *
   * @param currentTick The current tick of the game when the effect is triggered.
   */
  trigger(currentTick: number) {
    this.triggerAt = currentTick + this.interval;
  }
}
