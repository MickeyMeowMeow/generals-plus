import type { Effect } from "#/domain/effect/effect";

/**
 * Shared base for domain objects that can receive temporary or persistent effects.
 */
export abstract class EffectTarget implements EffectTarget {
  readonly targetId: string;

  /** Collection of active effects on the target. */
  readonly effects: Effect[] = [];

  constructor(targetId?: string) {
    this.targetId = targetId ?? Math.random().toString(36).substring(2, 15);
  }

  /**
   * Attaches an effect to the target.
   *
   * @param _currentTick The current tick of the game when the effect is attached.
   * @param effect The effect to add.
   */
  attachEffect(_currentTick: number, effect: Effect): void {
    if (effect.target !== this) {
      throw new Error(
        `Cannot attach effect "${effect.id}" to target "${this.targetId}" because it belongs to a different target.`,
      );
    }
    this.effects.push(effect);
  }

  /**
   * Removes an effect from the target by its ID.
   *
   * @param effectId The ID of the effect to remove.
   */
  removeEffect(effectId: string): void {
    const effectIndex = this.effects.findIndex(
      (effect) => effect.id === effectId,
    );
    if (effectIndex >= 0) {
      this.effects.splice(effectIndex, 1);
    }
  }
}
