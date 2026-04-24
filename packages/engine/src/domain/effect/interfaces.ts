import type { EffectType } from "#domain/effect/effect-type";

/**
 * Target that can have effects applied to it.
 */
export interface IEffectTarget {
  readonly id: string;

  /** Collection of active effects on the target. */
  readonly effects: IBaseEffect[];

  /**
   * Attaches an effect to the target.
   * Calls the effect's onAttach method if it exists.
   *
   * @param effect The effect to add.
   */
  attachEffect(effect: IBaseEffect): void;

  /**
   * Removes an effect from the target by its ID.
   * Calls the effect's onExpire method if it exists before removing it.
   *
   * @param effectId The ID of the effect to remove.
   */
  removeEffect(effectId: string): void;

  /**
   * Ticks all effects on the target, by calling their onTick method if it exists.
   *
   * @param currentTick The current tick of the game.
   */
  tickEffects(currentTick: number): void;
}

export interface ITroopCarrierTarget extends IEffectTarget {
  addTroops(delta: number): void;
}

/**
 * Base effect state for all effects.
 */
export interface IBaseEffect<TTarget extends IEffectTarget = IEffectTarget> {
  readonly id: string;
  readonly type: EffectType;

  /**
   * Target to which the effect is attached.
   */
  readonly target: TTarget;

  /**
   * Tick at which the effect will expire. If null, the effect does not expire.
   */
  readonly expireAt: number | null;

  /**
   * Triggers the effect, applying its impact immediately.
   */
  trigger(): void;

  /**
   * Called when the effect is attached to a target.
   * Can be used to initialize any necessary state or trigger immediate effects.
   */
  onAttach?(): void;

  /**
   * Called when the effect expires.
   * Can be used to clean up any state or trigger expiration effects.
   */
  onExpire?(): void;

  /**
   * Called on each tick while the effect is active.
   * Can be used to trigger periodic effects or update state.
   */
  onTick?(currentTick: number): void;
}

/**
 * Effects that are triggered at regular intervals.
 */
export interface IPeriodicEffect<TTarget extends IEffectTarget = IEffectTarget>
  extends IBaseEffect<TTarget> {
  readonly type:
    | typeof EffectType.TROOP_GENERATION
    | typeof EffectType.TROOP_DRAIN;

  /**
   * Interval in ticks at which the effect will be triggered.
   */
  readonly interval: number;

  /**
   * Tick at which the effect will be triggered next.
   */
  triggerAt: number;
}

/**
 * Effects that increment or decrement troop counts at regular intervals.
 */
export interface ITroopModificationEffect extends IPeriodicEffect {
  readonly target: ITroopCarrierTarget;

  readonly type:
    | typeof EffectType.TROOP_GENERATION
    | typeof EffectType.TROOP_DRAIN;

  /**
   * Number of troops to generate or drain. Positive for generation, negative for drain.
   */
  readonly delta: number;
}
