import type {
  IClassicScoreboard,
  ITurfWarScoreboard,
} from "@generals-plus/engine";
import { GameMode, PlayerStatus } from "@generals-plus/engine";
import {
  ClassicScoreboard,
  PublicPlayer,
  TurfWarScoreboard,
} from "@generals-plus/shared-types";
import { describe, expect, it } from "vitest";

import { createScoreboard, syncScoreboard } from "#/features/scoreboard/utils";

describe("createScoreboard", () => {
  it("creates ClassicScoreboard for classic mode", () => {
    const scoreboard = createScoreboard(GameMode.CLASSIC);

    expect(scoreboard).toBeInstanceOf(ClassicScoreboard);
    expect(scoreboard.mode).toBe(GameMode.CLASSIC);
  });

  it("creates TurfWarScoreboard for turf war mode", () => {
    const scoreboard = createScoreboard(GameMode.TURF_WAR);

    expect(scoreboard).toBeInstanceOf(TurfWarScoreboard);
    expect(scoreboard.mode).toBe(GameMode.TURF_WAR);
  });

  it("falls back to ClassicScoreboard for unknown mode", () => {
    const scoreboard = createScoreboard("unknown" as GameMode);

    expect(scoreboard.mode).toBe("unknown");
    expect(scoreboard).toBeInstanceOf(ClassicScoreboard);
  });
});

describe("syncScoreboard", () => {
  it("syncs classic scoreboard with player entries", () => {
    const target = createScoreboard(GameMode.CLASSIC);
    const source: IClassicScoreboard = {
      mode: GameMode.CLASSIC,
      players: [
        { playerId: "p1", troops: 10, land: 5, isAlive: true },
        { playerId: "p2", troops: 3, land: 1, isAlive: false },
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
      isAlive: true,
    });
    expect(classic.players.at(1)).toMatchObject({
      playerId: "p2",
      troops: 3,
      land: 1,
      isAlive: false,
    });
  });

  it("enriches player entries with public player metadata", () => {
    const target = createScoreboard(GameMode.CLASSIC);

    syncScoreboard(
      target,
      {
        mode: GameMode.CLASSIC,
        players: [{ playerId: "p1", troops: 10, land: 5, isAlive: true }],
      } as IClassicScoreboard,
      [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "t1",
          displayName: "Nova",
          color: 0xff0000,
          status: PlayerStatus.ACTIVE,
        }),
      ],
    );

    const classic = target as ClassicScoreboard;
    expect(classic.players.at(0)).toMatchObject({
      playerId: "p1",
      teamId: "t1",
      displayName: "Nova",
      color: 0xff0000,
      troops: 10,
      land: 5,
    });
  });

  it("replaces previous entries on re-sync", () => {
    const target = createScoreboard(GameMode.CLASSIC);

    syncScoreboard(target, {
      mode: GameMode.CLASSIC,
      players: [{ playerId: "p1", troops: 5, land: 2, isAlive: true }],
    } as IClassicScoreboard);

    syncScoreboard(target, {
      mode: GameMode.CLASSIC,
      players: [
        { playerId: "p2", troops: 8, land: 3, isAlive: false },
        { playerId: "p3", troops: 1, land: 1, isAlive: true },
      ],
    } as IClassicScoreboard);

    const classic = target as ClassicScoreboard;
    expect(classic.players.length).toBe(2);
    expect(classic.players.at(0)?.playerId).toBe("p2");
    expect(classic.players.at(1)?.playerId).toBe("p3");
  });

  it("handles empty players array", () => {
    const target = createScoreboard(GameMode.CLASSIC);

    syncScoreboard(target, {
      mode: GameMode.CLASSIC,
      players: [{ playerId: "p1", troops: 1, land: 1, isAlive: true }],
    } as IClassicScoreboard);

    syncScoreboard(target, {
      mode: GameMode.CLASSIC,
      players: [],
    } as IClassicScoreboard);

    const classic = target as ClassicScoreboard;
    expect(classic.players.length).toBe(0);
  });

  it("syncs turf_war scoreboard with player and team entries", () => {
    const target = createScoreboard(GameMode.TURF_WAR);
    const source: ITurfWarScoreboard = {
      mode: GameMode.TURF_WAR,
      players: [
        { playerId: "p1", troops: 10, land: 5, isAlive: true },
        { playerId: "p2", troops: 3, land: 1, isAlive: false },
      ],
      teams: [
        { teamId: "t1", playerIds: ["p1"], landPercent: 83 },
        { teamId: "t2", playerIds: ["p2"], landPercent: 17 },
      ],
    };

    syncScoreboard(target, source);

    expect(target.mode).toBe(GameMode.TURF_WAR);
    const tw = target as TurfWarScoreboard;
    expect(tw.players.length).toBe(2);
    expect(tw.players.at(0)).toMatchObject({
      playerId: "p1",
      troops: 10,
      land: 5,
    });
  });

  it("falls back to classic sync for unknown mode", () => {
    const target = createScoreboard("unknown" as GameMode);
    const source = {
      mode: "unknown",
      players: [{ playerId: "p1", troops: 10, land: 5, isAlive: true }],
    };

    syncScoreboard(target, source as unknown as IClassicScoreboard);

    expect(target.mode).toBe("unknown");
    const classic = target as ClassicScoreboard;
    expect(classic.players.length).toBe(1);
    expect(classic.players.at(0)).toMatchObject({
      playerId: "p1",
      troops: 10,
      land: 5,
      isAlive: true,
    });
  });
});
