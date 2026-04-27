import { describe, expect, it } from "vitest";

import { Effect } from "#/domain/effect/effect";
import { EffectTarget } from "#/domain/effect/effect-target";
import { EffectType } from "#/domain/effect/effect-type";

class MockTarget extends EffectTarget {}

class MockEffect extends Effect<MockTarget> {}

describe("EffectTarget", () => {
  it("should successfully attach an effect belonging to the target", () => {
    const target = new MockTarget("target-1");
    const effect = new MockEffect(0, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      target: target,
    });

    target.attachEffect(effect);
    expect(target.effects).toHaveLength(1);
    expect(target.effects[0]).toBe(effect);
  });

  it("should throw an error if attaching an effect that belongs to a different target", () => {
    const target1 = new MockTarget("target-1");
    const target2 = new MockTarget("target-2");

    const effectForTarget2 = new MockEffect(0, {
      id: "eff-2",
      type: EffectType.TROOP_GENERATION,
      target: target2,
    });

    expect(() => target1.attachEffect(effectForTarget2)).toThrow(
      /Cannot attach effect "eff-2" to target "target-1"/,
    );
  });

  it("should remove an effect by ID", () => {
    const target = new MockTarget("target-1");
    const effect = new MockEffect(0, {
      id: "eff-1",
      type: EffectType.TROOP_GENERATION,
      target: target,
    });

    target.attachEffect(effect);
    expect(target.effects).toHaveLength(1);

    target.removeEffect("eff-1");
    expect(target.effects).toHaveLength(0);
  });

  it("should not error when removing a non-existent effect", () => {
    const target = new MockTarget("target-1");
    expect(() => target.removeEffect("non-existent")).not.toThrow();
  });
});
