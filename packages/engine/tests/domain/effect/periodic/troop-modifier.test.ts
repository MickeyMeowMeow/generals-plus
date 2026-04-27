import { describe, expect, it } from "vitest";

import { EffectTarget } from "#/domain/effect/effect-target";
import { EffectType } from "#/domain/effect/effect-type";
import { TroopModifierEffect } from "#/domain/effect/periodic/troop-modifier";

class MockTroopCarrier extends EffectTarget {
  public troops = 0;

  constructor() {
    super("cell-1");
  }

  addTroops(delta: number): void {
    this.troops += delta;
  }
}

describe("TroopModifierEffect", () => {
  it("should initialize with correct triggerAt calculation", () => {
    const target = new MockTroopCarrier();
    const effect = new TroopModifierEffect(100, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      interval: 25,
      delta: 1,
      target,
    });

    expect(effect.interval).toBe(25);
    expect(effect.delta).toBe(1);
    expect(effect.triggerAt).toBe(125); // 100 + 25
  });

  it("should add troops and reschedule when triggered (Generation)", () => {
    const target = new MockTroopCarrier();
    const effect = new TroopModifierEffect(0, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      interval: 10,
      delta: 5,
      target,
    });

    effect.trigger(10); // Manually trigger at tick 10

    expect(target.troops).toBe(5);
    expect(effect.triggerAt).toBe(20); // Rescheduled
  });

  it("should subtract troops when triggered with negative delta (Drain)", () => {
    const target = new MockTroopCarrier();
    target.troops = 10; // Start with 10 troops

    const effect = new TroopModifierEffect(0, {
      id: "eff-1",
      type: EffectType.TROOP_DRAIN,
      interval: 5,
      delta: -2,
      target,
    });

    effect.trigger(5);

    expect(target.troops).toBe(8);
    expect(effect.triggerAt).toBe(10);
  });
});
