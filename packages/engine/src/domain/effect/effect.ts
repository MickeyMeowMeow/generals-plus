import type { EffectTarget } from "#/domain/effect/effect-target";
import type { EffectType } from "#/domain/effect/effect-type";

/**
 * Options for creating an effect, used in the constructor of `Effect`.
 */
export interface EffectOptions<TTarget extends EffectTarget> {
  id: string;
  type: EffectType;

  /**
   * Target to which the effect is attached.
   */
  target: TTarget;

  /**
   * Tick at which the effect will expire. If null, the effect does not expire.
   */
  expireAt?: number | null;
}

/**
 * Base class for all effects.
 */
export abstract class Effect<TTarget extends EffectTarget = EffectTarget> {
  readonly id: string;
  readonly type: EffectType;
  readonly target: TTarget;
  readonly expireAt: number | null;

  constructor(_currentTick: number, options: EffectOptions<TTarget>) {
    this.id = options.id;
    this.type = options.type;
    this.target = options.target;
    this.expireAt = options.expireAt ?? null;
  }

  /**
   * Called when the effect is attached to a target.
   * Can be used to initialize any necessary state or trigger immediate effects.
   *
   * @param currentTick The current tick of the game when the effect is attached.
   */
  onAttach?(currentTick: number): void;

  /**
   * Called when the effect expires.
   * Can be used to clean up any state or trigger expiration effects.
   *
   * @param currentTick The current tick of the game when the effect expires.
   */
  onExpire?(currentTick: number): void;

  /**
   * Called on each tick while the effect is active.
   * Can be used to trigger periodic effects or update state.
   *
   * @param currentTick The current tick of the game.
   */
  onTick?(currentTick: number): void;
}

/**
 * Effect that has a defined expiration tick, meaning it will expire after a certain number of ticks.
 */
export type ExpirableEffect<TTarget extends EffectTarget = EffectTarget> =
  Effect<TTarget> & { expireAt: number };

/**
 * Effect that has an `onTick` method, meaning it will trigger some behavior on each tick while active.
 */
export type TickingEffect<TTarget extends EffectTarget = EffectTarget> =
  Effect<TTarget> & {
    onTick(currentTick: number): void;
  };
