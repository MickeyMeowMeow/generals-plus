import type { IBaseEffect, IEffectTarget } from "@/domain/effect/interfaces";

/**
 * Shared base for domain objects that can receive temporary or persistent effects.
 */
export abstract class EffectTarget implements IEffectTarget {
  readonly id: string;
  readonly effects: IBaseEffect[] = [];

  protected constructor(id: string) {
    this.id = id;
  }

  /**
   * Attaches an effect and gives it a chance to initialize state on the target.
   */
  attachEffect(effect: IBaseEffect): void {
    if (effect.target !== this) {
      throw new Error(
        `Cannot attach effect "${effect.id}" to target "${this.id}" because it belongs to a different target.`,
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
   * Advances all active effects, expiring them before running same-tick updates.
   */
  tickEffects(currentTick: number): void {
    for (const effect of [...this.effects]) {
      if (effect.expireAt !== null && currentTick >= effect.expireAt) {
        this.removeEffect(effect.id);
        continue;
      }

      effect.onTick?.(currentTick);
    }
  }
}
