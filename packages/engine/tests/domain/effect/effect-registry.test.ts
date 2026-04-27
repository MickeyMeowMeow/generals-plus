import { describe, expect, it, vi } from "vitest";

import type { TickingEffect } from "#/domain/effect/effect";
import { Effect } from "#/domain/effect/effect";
import { EffectRegistry } from "#/domain/effect/effect-registry";
import { EffectTarget } from "#/domain/effect/effect-target";
import { EffectType } from "#/domain/effect/effect-type";
import { PeriodicEffect } from "#/domain/effect/periodic/periodic-effect";

class MockTarget extends EffectTarget {
  constructor() {
    super("target-1");
  }
}

class ExpirableDummyEffect extends Effect<MockTarget> {
  onAttach = vi.fn();
  onExpire = vi.fn();
}

class TickingDummyEffect
  extends Effect<MockTarget>
  implements TickingEffect<MockTarget>
{
  onTick = vi.fn();
}

class TriggerDummyEffect extends PeriodicEffect<MockTarget> {
  trigger = vi.fn((tick) => super.trigger(tick)); // Wrap to observe calls
}

describe("EffectRegistry", () => {
  it("should register an effect and call onAttach", () => {
    const registry = new EffectRegistry();
    const target = new MockTarget();
    const effect = new ExpirableDummyEffect(10, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      target,
    });

    registry.register(10, effect);

    expect(registry.effects.has(effect)).toBe(true);
    expect(effect.onAttach).toHaveBeenCalledWith(10);
    expect(target.effects).toContain(effect);
  });

  it("should expire effects exactly at their expireAt tick", () => {
    const registry = new EffectRegistry();
    const target = new MockTarget();
    const effect = new ExpirableDummyEffect(0, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      target,
      expireAt: 5,
    });

    registry.register(0, effect);

    registry.processTick(4);
    expect(registry.effects.has(effect)).toBe(true); // Still alive
    expect(effect.onExpire).not.toHaveBeenCalled();

    registry.processTick(5);
    expect(effect.onExpire).toHaveBeenCalledWith(5);
    expect(registry.effects.has(effect)).toBe(false); // Removed from registry
    expect(target.effects).not.toContain(effect); // Removed from target
  });

  it("should call onTick for ticking effects", () => {
    const registry = new EffectRegistry();
    const target = new MockTarget();
    const effect = new TickingDummyEffect(0, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      target,
    });

    registry.register(0, effect);

    registry.processTick(1);
    registry.processTick(2);

    expect(effect.onTick).toHaveBeenCalledTimes(2);
    expect(effect.onTick).toHaveBeenLastCalledWith(2);
  });

  it("should trigger periodic effects at the correct interval and reschedule", () => {
    const registry = new EffectRegistry();
    const target = new MockTarget();
    const effect = new TriggerDummyEffect(0, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      interval: 10,
      target,
    });

    registry.register(0, effect);
    expect(effect.triggerAt).toBe(10);

    registry.processTick(9);
    expect(effect.trigger).not.toHaveBeenCalled();

    registry.processTick(10);
    expect(effect.trigger).toHaveBeenCalledWith(10);
    expect(effect.triggerAt).toBe(20); // Automatically rescheduled
  });

  it("should safely ignore triggers and ticks for effects that have expired", () => {
    const registry = new EffectRegistry();
    const target = new MockTarget();

    // An effect that ticks AND expires
    const effect = new TickingDummyEffect(0, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      target,
      expireAt: 2,
    });

    registry.register(0, effect);

    registry.processTick(1);
    expect(effect.onTick).toHaveBeenCalledTimes(1);

    // Expire the effect at tick 2
    registry.processTick(2);
    expect(effect.onTick).toHaveBeenCalledTimes(1); // Should not have been called again
    expect(registry.tickingEffects.has(effect)).toBe(false); // Cleaned up

    // onTick should not be called after expiration
    registry.processTick(3);
    expect(effect.onTick).toHaveBeenCalledTimes(1); // Still only 1 call
  });
});
