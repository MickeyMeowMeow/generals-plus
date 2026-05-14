import type { IBaseGame } from "@generals-plus/engine";
import { GameMode, Terrain } from "@generals-plus/engine";
import { describe, expect, it } from "vitest";

import { createGame } from "#/features/game/utils";

function countGenerals(game: IBaseGame): number {
  let generalCount = 0;

  game.grid.forEach((cell) => {
    if (cell.terrain === Terrain.GENERAL) {
      generalCount++;
    }
  });

  return generalCount;
}

describe("createGame", () => {
  it("matches generated generals to player count by default", () => {
    const game = createGame({
      mode: GameMode.CLASSIC,
      playerIds: ["p1", "p2"],
    });

    expect(countGenerals(game)).toBe(2);
  });
});
