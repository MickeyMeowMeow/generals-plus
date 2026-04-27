import type { IBaseEffect, IEffectTarget } from "#/domain/effect/interfaces";

/**
 * Shared base for domain objects that can receive temporary or persistent effects.
 */
export abstract class EffectTarget implements IEffectTarget {
  readonly targetId: string;
  readonly effects: IBaseEffect[] = [];

  protected constructor(targetId?: string) {
    this.targetId = targetId ?? Math.random().toString(36).substring(2, 15);
  }

  /**
   * Attaches an effect and gives it a chance to initialize state on the target.
   */
  attachEffect(effect: IBaseEffect): void {
    if (effect.target !== this) {
      throw new Error(
        `Cannot attach effect "${effect.id}" to target "${this.targetId}" because it belongs to a different target.`,
      );
    }
    this.effects.push(effect);
    effect.onAttach?.();
  }

  /**
   * Removes an effect by ID and runs its cleanup hook when present.
   */
  removeEffect(effectId: string): void {
    const effectIndex = this.effects.findIndex(
      (effect) => effect.id === effectId,
    );
    if (effectIndex < 0) {
      return;
    }

    const [effect] = this.effects.splice(effectIndex, 1);
    effect?.onExpire?.();
  }

  /**
   * Advances all active effects.
   */
  tickEffects(currentTick: number): void {
    for (const effect of this.effects) {
      effect.onTick?.(currentTick);
    }
  }
}
