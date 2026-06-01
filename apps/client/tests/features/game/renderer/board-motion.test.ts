import { describe, expect, it } from "vitest";

import { getBoardPulse } from "#/features/game/renderer/board-motion";

describe("board motion helpers", () => {
  it("collapses scale movement under reduced motion", () => {
    expect(getBoardPulse({ ageMs: 120, reducedMotion: true }).scale).toBe(1);
  });
});
