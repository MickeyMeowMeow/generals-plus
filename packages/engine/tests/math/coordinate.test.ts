import { describe, expect, it } from "vitest";

import { isSameCoord } from "#/math/coordinate";

describe("isSameCoord", () => {
  it("returns true for identical coordinates", () => {
    expect(isSameCoord({ x: 0, y: 0 }, { x: -0, y: -0 })).toBe(true);
    expect(isSameCoord({ x: 5, y: -3 }, { x: 5, y: -3 })).toBe(true);
  });

  it("returns false for coordinates with different x values", () => {
    expect(isSameCoord({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });

  it("returns false for coordinates with different y values", () => {
    expect(isSameCoord({ x: 0, y: 1 }, { x: 0, y: 0 })).toBe(false);
  });

  it("returns false for completely different coordinates", () => {
    expect(isSameCoord({ x: 1, y: 1 }, { x: -1, y: -1 })).toBe(false);
  });
});
