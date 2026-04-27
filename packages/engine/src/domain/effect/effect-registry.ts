import { MinHeap } from "data-structure-typed/heap";

import type {
  Effect,
  ExpirableEffect,
  TickingEffect,
} from "#/domain/effect/effect";
import { PeriodicEffect } from "#/domain/effect/periodic/periodic-effect";

export class EffectRegistry {
  readonly effects = new Set<Effect>();

  readonly expirationQueue = new MinHeap<ExpirableEffect>([], {
    comparator: (a, b) => a.expireAt - b.expireAt,
  });

  readonly tickingEffects = new Set<TickingEffect>();

  readonly triggerQueue = new MinHeap<PeriodicEffect>([], {
    comparator: (a, b) => a.triggerAt - b.triggerAt,
  });

  /**
   * Registers a new effect in the registry, attaching it to its target and scheduling it for expiration or periodic triggering.
   *
   * @param currentTick The current tick of the game when the effect is registered.
   * @param effect The effect to register.
   */
  register(currentTick: number, effect: Effect): void {
    this.effects.add(effect);
    if (effect.expireAt !== null) {
      this.expirationQueue.add(effect as ExpirableEffect);
    }
    if (effect.onTick) {
      this.tickingEffects.add(effect as TickingEffect);
    }
    if (effect instanceof PeriodicEffect) {
      this.triggerQueue.add(effect);
    }

    effect.target.attachEffect(effect);
    effect.onAttach?.(currentTick);
  }

  /**
   * Processes the effects in the registry for the current tick, handling expiration and triggering of periodic effects.
   *
   * @param currentTick The current tick of the game.
   */
  processTick(currentTick: number): void {
    let earliest: number | undefined;

    while (true) {
      earliest = this.expirationQueue.peek()?.expireAt;
      if (earliest === undefined || earliest > currentTick) {
        break;
      }
      const effect = this.expirationQueue.pop();
      if (effect) {
        effect.onExpire?.(currentTick);
        effect.target.removeEffect(effect.id);
        this.effects.delete(effect);
      }
    }

    for (const effect of this.tickingEffects) {
      if (!this.effects.has(effect)) {
        this.tickingEffects.delete(effect);
        continue;
      }
      effect.onTick(currentTick);
    }

    while (true) {
      earliest = this.triggerQueue.peek()?.triggerAt;
      if (earliest === undefined || earliest > currentTick) {
        break;
      }
      const effect = this.triggerQueue.pop();
      if (effect && this.effects.has(effect)) {
        effect.trigger(currentTick);
        this.triggerQueue.add(effect);
      }
    }
  }
}
