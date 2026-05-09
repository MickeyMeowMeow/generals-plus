import type { IClassicScoreboard } from "@generals-plus/engine";
import { GameMode } from "@generals-plus/engine";
import { ClassicScoreboard } from "@generals-plus/shared-types";
import { describe, expect, it } from "vitest";

import { createScoreboard, syncScoreboard } from "#/features/scoreboard/utils";

describe("createScoreboard", () => {
  it("creates ClassicScoreboard for classic mode", () => {
    const scoreboard = createScoreboard(GameMode.CLASSIC);

    expect(scoreboard).toBeInstanceOf(ClassicScoreboard);
    expect(scoreboard.mode).toBe("");
  });

  it("creates BaseScoreboard for unknown mode", () => {
    const scoreboard = createScoreboard("unknown" as GameMode);

    expect(scoreboard.mode).toBe("");
    expect(scoreboard).not.toBeInstanceOf(ClassicScoreboard);
  });
});

describe("syncScoreboard", () => {
  it("syncs classic scoreboard with player entries", () => {
    const target = createScoreboard(GameMode.CLASSIC);
    const source: IClassicScoreboard = {
      mode: GameMode.CLASSIC,
      players: [
        { playerId: "p1", troops: 10, land: 5, isGeneralAlive: true },
        { playerId: "p2", troops: 3, land: 1, isGeneralAlive: false },
      ],
    };

    syncScoreboard(target, source);

    expect(target.mode).toBe(GameMode.CLASSIC);
    const classic = target as ClassicScoreboard;
    expect(classic.players.length).toBe(2);
    expect(classic.players.at(0)).toMatchObject({
      playerId: "p1",
      troops: 10,
      land: 5,
      isGeneralAlive: true,
    });
    expect(classic.players.at(1)).toMatchObject({
      playerId: "p2",
      troops: 3,
      land: 1,
      isGeneralAlive: false,
    });
  });

  it("replaces previous entries on re-sync", () => {
    const target = createScoreboard(GameMode.CLASSIC);

    syncScoreboard(target, {
      mode: GameMode.CLASSIC,
      players: [{ playerId: "p1", troops: 5, land: 2, isGeneralAlive: true }],
    });

    syncScoreboard(target, {
      mode: GameMode.CLASSIC,
      players: [
        { playerId: "p2", troops: 8, land: 3, isGeneralAlive: false },
        { playerId: "p3", troops: 1, land: 1, isGeneralAlive: true },
      ],
    });

    const classic = target as ClassicScoreboard;
    expect(classic.players.length).toBe(2);
    expect(classic.players.at(0)?.playerId).toBe("p2");
    expect(classic.players.at(1)?.playerId).toBe("p3");
  });

  it("handles empty players array", () => {
    const target = createScoreboard(GameMode.CLASSIC);

    syncScoreboard(target, {
      mode: GameMode.CLASSIC,
      players: [{ playerId: "p1", troops: 1, land: 1, isGeneralAlive: true }],
    });

    syncScoreboard(target, {
      mode: GameMode.CLASSIC,
      players: [],
    });

    const classic = target as ClassicScoreboard;
    expect(classic.players.length).toBe(0);
  });
});
