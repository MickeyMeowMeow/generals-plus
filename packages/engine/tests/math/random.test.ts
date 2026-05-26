import { describe, expect, it } from "vitest";

import { SeededRandom } from "#/math/random";

describe("SeededRandom", () => {
  const SEED = 123456789;

  it("produces deterministic sequences for the same seed", () => {
    const rng1 = new SeededRandom(SEED);
    const rng2 = new SeededRandom(SEED);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it("produces values within the expected [0, 1) range for next()", () => {
    const rng = new SeededRandom(SEED);
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("produces integers within the expected [0, max) range for nextInt()", () => {
    const rng = new SeededRandom(SEED);
    const max = 10;
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(max);
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(max);
    }
  });

  it("shuffles arrays deterministically and in-place", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rng1 = new SeededRandom(SEED);
    const rng2 = new SeededRandom(SEED);

    const arr1 = [...input];
    const arr2 = [...input];

    const result1 = rng1.shuffle(arr1);
    const result2 = rng2.shuffle(arr2);

    // Verify in-place mutation
    expect(result1).toBe(arr1);
    expect(result2).toBe(arr2);
    // Verify determinism
    expect(arr1).toEqual(arr2);
    // Verify all elements are still present
    expect([...arr1].sort((a, b) => a - b)).toEqual(input);
  });

  it("derives child generators that are deterministic and isolated", () => {
    const parent = new SeededRandom(SEED);
    const child = parent.derive();

    // The child should be deterministic if recreated from the same parent state
    const parentMirror = new SeededRandom(SEED);
    const childMirror = parentMirror.derive();

    for (let i = 0; i < 50; i++) {
      expect(child.next()).toBe(childMirror.next());
    }

    // State isolation: Parent and child should not interfere with each other
    const parentNext = parent.next();
    child.next();
    expect(parent.next()).not.toBe(parentNext);
  });

  it("handles negative seeds via unsigned bitwise shift", () => {
    const rng1 = new SeededRandom(-1);
    const rng2 = new SeededRandom(4294967295); // -1 >>> 0

    expect(rng1.next()).toBe(rng2.next());
  });
});
