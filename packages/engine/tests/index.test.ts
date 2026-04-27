import { describe, expect, it } from "vitest";

import {
  Cell,
  DefaultGridGenerator,
  EffectTarget,
  Grid,
  Terrain,
} from "../src/index";

describe("engine public exports", () => {
  it("exports core grid/effect primitives", () => {
    expect(Cell).toBeTypeOf("function");
    expect(Grid).toBeTypeOf("function");
    expect(DefaultGridGenerator).toBeTypeOf("function");
    expect(EffectTarget).toBeTypeOf("function");
    expect(Terrain.PLAIN).toBe("plain");
  });
});