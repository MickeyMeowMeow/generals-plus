import { describe, expect, it, vi } from "vitest";

import { EffectType } from "../../../src/domain/effect/effect-type";
import type { IBaseEffect } from "../../../src/domain/effect/interfaces";
import { EffectTarget } from "../../../src/domain/effect/effect-target";

class DummyTarget extends EffectTarget {
  constructor(targetId?: string) {
    super(targetId);
  }
}

function createEffect(target: DummyTarget, id = "effect-1"): IBaseEffect {
  return {
    id,
    type: EffectType.TROOP_GENERATION,
    target,
    expireAt: null,
    trigger: vi.fn(),
  };
}

describe("EffectTarget", () => {
  it("uses provided targetId and creates one when omitted", () => {
    const fixed = new DummyTarget("target-1");
    const generated = new DummyTarget();

    expect(fixed.targetId).toBe("target-1");
    expect(generated.targetId.length).toBeGreaterThan(0);
  });

  it("attaches matching effects and runs onAttach", () => {
    const target = new DummyTarget("target-1");
    const onAttach = vi.fn();
    const effect: IBaseEffect = {
      ...createEffect(target),
      onAttach,
    };

    target.attachEffect(effect);

    expect(target.effects).toHaveLength(1);
    expect(target.effects[0]).toBe(effect);
    expect(onAttach).toHaveBeenCalledTimes(1);
  });

  it("throws when attaching an effect that belongs to another target", () => {
    const targetA = new DummyTarget("A");
    const targetB = new DummyTarget("B");
    const effectForA = createEffect(targetA);

    expect(() => targetB.attachEffect(effectForA)).toThrow(
      /belongs to a different target/i,
    );
  });

  it("removes effect by id and runs onExpire", () => {
    const target = new DummyTarget("target-1");
    const onExpire = vi.fn();
    const effect: IBaseEffect = {
      ...createEffect(target, "to-remove"),
      onExpire,
    };

    target.attachEffect(effect);
    target.removeEffect("to-remove");

    expect(target.effects).toHaveLength(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("ignores removing non-existing effect ids", () => {
    const target = new DummyTarget("target-1");

    expect(() => target.removeEffect("missing")).not.toThrow();
    expect(target.effects).toHaveLength(0);
  });

  it("ticks all effects with the provided tick value", () => {
    const target = new DummyTarget("target-1");
    const onTickA = vi.fn();
    const onTickB = vi.fn();

    target.attachEffect({
      ...createEffect(target, "a"),
      onTick: onTickA,
    });
    target.attachEffect({
      ...createEffect(target, "b"),
      onTick: onTickB,
    });

    target.tickEffects(42);

    expect(onTickA).toHaveBeenCalledWith(42);
    expect(onTickB).toHaveBeenCalledWith(42);
  });
});