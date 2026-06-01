import type {
  IClassicScoreboard,
  IDemolitionScoreboard,
  IDominationScoreboard,
  ITurfWarScoreboard,
} from "@generals-plus/engine";
import { GameMode, PlayerStatus } from "@generals-plus/engine";
import {
  ClassicScoreboard,
  DemolitionScoreboard,
  DominationScoreboard,
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

  it("incrementally updates turf_war teams when team count stays the same", () => {
    const target = createScoreboard(GameMode.TURF_WAR);

    // First sync
    syncScoreboard(target, {
      mode: GameMode.TURF_WAR,
      players: [
        { playerId: "p1", troops: 10, land: 5, isAlive: true },
        { playerId: "p2", troops: 3, land: 1, isAlive: true },
      ],
      teams: [
        { teamId: "t1", playerIds: ["p1"], landPercent: 83 },
        { teamId: "t2", playerIds: ["p2"], landPercent: 17 },
      ],
    } as ITurfWarScoreboard);

    const tw = target as TurfWarScoreboard;
    const team0Ref = tw.teams.at(0);
    const team1Ref = tw.teams.at(1);

    // Second sync: same team count → incremental path
    syncScoreboard(target, {
      mode: GameMode.TURF_WAR,
      players: [
        { playerId: "p1", troops: 20, land: 8, isAlive: true },
        { playerId: "p2", troops: 5, land: 2, isAlive: false },
      ],
      teams: [
        { teamId: "t1", playerIds: ["p1"], landPercent: 80 },
        { teamId: "t2", playerIds: ["p2"], landPercent: 20 },
      ],
    } as ITurfWarScoreboard);

    // Schema instances reused
    expect(tw.teams.at(0)).toBe(team0Ref);
    expect(tw.teams.at(1)).toBe(team1Ref);

    // landPercent updated
    expect(tw.teams.at(0)?.landPercent).toBe(80);
    expect(tw.teams.at(1)?.landPercent).toBe(20);

    // Player fields updated
    expect(tw.players.at(0)).toMatchObject({ troops: 20, land: 8 });
    expect(tw.players.at(1)).toMatchObject({ troops: 5, isAlive: false });
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

  describe("incremental update (same player count)", () => {
    it("updates changed player fields in place without clear/rebuild", () => {
      const target = createScoreboard(GameMode.CLASSIC);

      // First sync: populate
      syncScoreboard(target, {
        mode: GameMode.CLASSIC,
        players: [
          { playerId: "p1", troops: 10, land: 5, isAlive: true },
          { playerId: "p2", troops: 3, land: 1, isAlive: true },
        ],
      } as IClassicScoreboard);

      const classic = target as ClassicScoreboard;
      const p0Ref = classic.players.at(0);
      const p1Ref = classic.players.at(1);

      // Second sync: same count, different values → incremental path
      syncScoreboard(target, {
        mode: GameMode.CLASSIC,
        players: [
          { playerId: "p1", troops: 20, land: 8, isAlive: true },
          { playerId: "p2", troops: 3, land: 1, isAlive: false },
        ],
      } as IClassicScoreboard);

      // Schema instances should be reused (same reference)
      expect(classic.players.at(0)).toBe(p0Ref);
      expect(classic.players.at(1)).toBe(p1Ref);

      // Changed fields updated
      expect(classic.players.at(0)).toMatchObject({
        playerId: "p1",
        troops: 20,
        land: 8,
        isAlive: true,
      });
      expect(classic.players.at(1)).toMatchObject({
        playerId: "p2",
        troops: 3, // unchanged
        land: 1, // unchanged
        isAlive: false, // changed
      });
    });

    it("reuses schema instances when syncing metadata that has not changed", () => {
      const metadata: PublicPlayer[] = [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "t1",
          displayName: "Alpha",
          color: 1,
          status: PlayerStatus.ACTIVE,
        }),
      ];

      const target = createScoreboard(GameMode.CLASSIC);
      syncScoreboard(
        target,
        {
          mode: GameMode.CLASSIC,
          players: [{ playerId: "p1", troops: 5, land: 2, isAlive: true }],
        } as IClassicScoreboard,
        metadata,
      );

      const classic = target as ClassicScoreboard;
      const p0Ref = classic.players.at(0);

      syncScoreboard(
        target,
        {
          mode: GameMode.CLASSIC,
          players: [{ playerId: "p1", troops: 15, land: 6, isAlive: true }],
        } as IClassicScoreboard,
        metadata,
      );

      expect(classic.players.at(0)).toBe(p0Ref);
      expect(classic.players.at(0)).toMatchObject({
        playerId: "p1",
        teamId: "t1",
        displayName: "Alpha",
        color: 1,
        troops: 15,
        land: 6,
      });
    });
  });

  describe("domination mode", () => {
    it("creates DominationScoreboard for domination mode", () => {
      const scoreboard = createScoreboard(GameMode.DOMINATION);

      expect(scoreboard).toBeInstanceOf(DominationScoreboard);
      expect(scoreboard.mode).toBe(GameMode.DOMINATION);
    });

    it("syncs domination scoreboard with player and team entries", () => {
      const target = createScoreboard(GameMode.DOMINATION);
      const source: IDominationScoreboard = {
        mode: GameMode.DOMINATION,
        players: [
          { playerId: "p1", troops: 10, land: 5, isAlive: true },
          { playerId: "p2", troops: 3, land: 1, isAlive: false },
        ],
        teamScores: new Map([
          ["t1", 150],
          ["t2", 80],
        ]),
      };

      syncScoreboard(target, source, [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "t1",
          displayName: "Alpha",
          color: 1,
          status: PlayerStatus.ACTIVE,
        }),
        Object.assign(new PublicPlayer(), {
          id: "p2",
          teamId: "t2",
          displayName: "Beta",
          color: 2,
          status: PlayerStatus.ELIMINATED,
        }),
      ]);

      expect(target.mode).toBe(GameMode.DOMINATION);
      const dom = target as DominationScoreboard;
      expect(dom.players.length).toBe(2);
      expect(dom.players.at(0)).toMatchObject({
        playerId: "p1",
        teamId: "t1",
        displayName: "Alpha",
        troops: 10,
        land: 5,
        isAlive: true,
      });
      expect(dom.players.at(1)).toMatchObject({
        playerId: "p2",
        teamId: "t2",
        displayName: "Beta",
        troops: 3,
        land: 1,
        isAlive: false,
      });
      expect(dom.teams.length).toBe(2);
      expect(dom.teams.at(0)).toMatchObject({
        teamId: "t1",
        score: 150,
      });
      expect(Array.from(dom.teams.at(0)?.playerIds ?? [])).toEqual(["p1"]);
      expect(dom.teams.at(1)).toMatchObject({
        teamId: "t2",
        score: 80,
      });
      expect(Array.from(dom.teams.at(1)?.playerIds ?? [])).toEqual(["p2"]);
    });

    it("incrementally updates team entries when team count stays the same", () => {
      const target = createScoreboard(GameMode.DOMINATION);
      const metadata = [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "t1",
          displayName: "A",
          color: 1,
          status: PlayerStatus.ACTIVE,
        }),
        Object.assign(new PublicPlayer(), {
          id: "p2",
          teamId: "t2",
          displayName: "B",
          color: 2,
          status: PlayerStatus.ACTIVE,
        }),
      ];

      // First sync
      syncScoreboard(
        target,
        {
          mode: GameMode.DOMINATION,
          players: [
            { playerId: "p1", troops: 10, land: 5, isAlive: true },
            { playerId: "p2", troops: 3, land: 1, isAlive: true },
          ],
          teamScores: new Map([
            ["t1", 100],
            ["t2", 50],
          ]),
        } as IDominationScoreboard,
        metadata,
      );

      const dom = target as DominationScoreboard;
      const team0Ref = dom.teams.at(0);
      const team1Ref = dom.teams.at(1);

      // Second sync: same player/team count → incremental path
      syncScoreboard(
        target,
        {
          mode: GameMode.DOMINATION,
          players: [
            { playerId: "p1", troops: 25, land: 12, isAlive: true },
            { playerId: "p2", troops: 3, land: 1, isAlive: false },
          ],
          teamScores: new Map([
            ["t1", 200],
            ["t2", 50],
          ]),
        } as IDominationScoreboard,
        metadata,
      );

      // Schema instances reused
      expect(dom.teams.at(0)).toBe(team0Ref);
      expect(dom.teams.at(1)).toBe(team1Ref);

      // Scores updated
      expect(dom.teams.at(0)?.score).toBe(200);
      expect(dom.teams.at(1)?.score).toBe(50); // unchanged

      // Player fields updated
      expect(dom.players.at(0)).toMatchObject({ troops: 25, land: 12 });
      expect(dom.players.at(1)).toMatchObject({ isAlive: false });
    });

    it("replaces previous team entries on re-sync", () => {
      const target = createScoreboard(GameMode.DOMINATION);

      const source1: IDominationScoreboard = {
        mode: GameMode.DOMINATION,
        players: [{ playerId: "p1", troops: 5, land: 2, isAlive: true }],
        teamScores: new Map([["t1", 50]]),
      };
      syncScoreboard(target, source1, [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "t1",
          displayName: "A",
          color: 1,
          status: PlayerStatus.ACTIVE,
        }),
      ]);

      const source2: IDominationScoreboard = {
        mode: GameMode.DOMINATION,
        players: [
          { playerId: "p1", troops: 20, land: 8, isAlive: true },
          { playerId: "p2", troops: 15, land: 6, isAlive: true },
        ],
        teamScores: new Map([
          ["t1", 200],
          ["t2", 180],
        ]),
      };
      syncScoreboard(target, source2, [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "t1",
          displayName: "A",
          color: 1,
          status: PlayerStatus.ACTIVE,
        }),
        Object.assign(new PublicPlayer(), {
          id: "p2",
          teamId: "t2",
          displayName: "B",
          color: 2,
          status: PlayerStatus.ACTIVE,
        }),
      ]);

      const dom = target as DominationScoreboard;
      expect(dom.players.length).toBe(2);
      expect(dom.teams.length).toBe(2);
      expect(dom.teams.at(0)?.score).toBe(200);
      expect(dom.teams.at(1)?.score).toBe(180);
    });
  });

  // ── Demolition mode ───────────────────────────────────────────

  describe("demolition mode", () => {
    it("creates DemolitionScoreboard for demolition mode", () => {
      const scoreboard = createScoreboard(GameMode.DEMOLITION);

      expect(scoreboard).toBeInstanceOf(DemolitionScoreboard);
      expect(scoreboard.mode).toBe(GameMode.DEMOLITION);
    });

    it("syncs demolition scoreboard with player entries and bomb fields", () => {
      const target = createScoreboard(GameMode.DEMOLITION);
      const source: IDemolitionScoreboard = {
        mode: GameMode.DEMOLITION,
        players: [
          { playerId: "p1", troops: 15, land: 7, isAlive: true },
          { playerId: "p2", troops: 8, land: 3, isAlive: true },
        ],
        bombSiteCount: 2,
        plantedAtSite: "A",
        detonationTick: 450,
        plantProgressTicks: 10,
        defuseProgressTicks: 3,
        defuserId: "p2",
        isPlanted: true,
        isDefused: false,
        plantDurationTicks: 6,
        defuseDurationTicks: 10,
        detonateDurationTicks: 90,
      };

      syncScoreboard(target, source);

      expect(target.mode).toBe(GameMode.DEMOLITION);
      const demo = target as DemolitionScoreboard;

      // Player entries
      expect(demo.players.length).toBe(2);
      expect(demo.players.at(0)).toMatchObject({
        playerId: "p1",
        troops: 15,
        land: 7,
        isAlive: true,
      });
      expect(demo.players.at(1)).toMatchObject({
        playerId: "p2",
        troops: 8,
        land: 3,
        isAlive: true,
      });

      // Bomb fields
      expect(demo.bombSiteCount).toBe(2);
      expect(demo.plantedAtSite).toBe("A");
      expect(demo.detonationTick).toBe(450);
      expect(demo.plantProgressTicks).toBe(10);
      expect(demo.defuseProgressTicks).toBe(3);
      expect(demo.defuserId).toBe("p2");
      expect(demo.isPlanted).toBe(true);
      expect(demo.isDefused).toBe(false);
      expect(demo.plantDurationTicks).toBe(6);
      expect(demo.defuseDurationTicks).toBe(10);
      expect(demo.detonateDurationTicks).toBe(90);
    });

    it("enriches demolition player entries with public player metadata", () => {
      const target = createScoreboard(GameMode.DEMOLITION);
      const source: IDemolitionScoreboard = {
        mode: GameMode.DEMOLITION,
        players: [
          { playerId: "p1", troops: 20, land: 10, isAlive: true },
          { playerId: "p2", troops: 5, land: 2, isAlive: false },
        ],
        bombSiteCount: 1,
        plantedAtSite: null,
        detonationTick: null,
        plantProgressTicks: 0,
        defuseProgressTicks: 0,
        defuserId: null,
        isPlanted: false,
        isDefused: false,
        plantDurationTicks: 6,
        defuseDurationTicks: 10,
        detonateDurationTicks: 90,
      };

      syncScoreboard(target, source, [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "attackers",
          displayName: "Bomber",
          color: 0xff0000,
          status: PlayerStatus.ACTIVE,
        }),
        Object.assign(new PublicPlayer(), {
          id: "p2",
          teamId: "defenders",
          displayName: "Defuser",
          color: 0x0000ff,
          status: PlayerStatus.ACTIVE,
        }),
      ]);

      const demo = target as DemolitionScoreboard;
      expect(demo.players.at(0)).toMatchObject({
        playerId: "p1",
        teamId: "attackers",
        displayName: "Bomber",
        color: 0xff0000,
        troops: 20,
        land: 10,
      });
      expect(demo.players.at(1)).toMatchObject({
        playerId: "p2",
        teamId: "defenders",
        displayName: "Defuser",
        color: 0x0000ff,
        troops: 5,
        land: 2,
        isAlive: false,
      });
    });

    it("uses empty string / -1 defaults for nullable bomb fields", () => {
      const target = createScoreboard(GameMode.DEMOLITION);
      const source: IDemolitionScoreboard = {
        mode: GameMode.DEMOLITION,
        players: [],
        bombSiteCount: 2,
        plantedAtSite: null,
        detonationTick: null,
        plantProgressTicks: 0,
        defuseProgressTicks: 0,
        defuserId: null,
        isPlanted: false,
        isDefused: false,
        plantDurationTicks: 6,
        defuseDurationTicks: 10,
        detonateDurationTicks: 90,
      };

      syncScoreboard(target, source);

      const demo = target as DemolitionScoreboard;
      expect(demo.plantedAtSite).toBe("");
      expect(demo.detonationTick).toBe(-1);
      expect(demo.defuserId).toBe("");
    });

    it("builds team entries from player metadata", () => {
      const target = createScoreboard(GameMode.DEMOLITION);
      const source: IDemolitionScoreboard = {
        mode: GameMode.DEMOLITION,
        players: [
          { playerId: "p1", troops: 10, land: 5, isAlive: true },
          { playerId: "p2", troops: 3, land: 1, isAlive: true },
          { playerId: "p3", troops: 7, land: 4, isAlive: false },
        ],
        bombSiteCount: 2,
        plantedAtSite: null,
        detonationTick: null,
        plantProgressTicks: 0,
        defuseProgressTicks: 0,
        defuserId: null,
        isPlanted: false,
        isDefused: false,
        plantDurationTicks: 6,
        defuseDurationTicks: 10,
        detonateDurationTicks: 90,
      };

      syncScoreboard(target, source, [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "attackers",
          displayName: "A1",
          color: 1,
          status: PlayerStatus.ACTIVE,
        }),
        Object.assign(new PublicPlayer(), {
          id: "p2",
          teamId: "attackers",
          displayName: "A2",
          color: 2,
          status: PlayerStatus.ACTIVE,
        }),
        Object.assign(new PublicPlayer(), {
          id: "p3",
          teamId: "defenders",
          displayName: "D1",
          color: 3,
          status: PlayerStatus.ELIMINATED,
        }),
      ]);

      const demo = target as DemolitionScoreboard;
      expect(demo.teams.length).toBe(2);

      // First team (attackers) should have p1 and p2
      expect(demo.teams.at(0)).toMatchObject({ teamId: "attackers" });
      expect(Array.from(demo.teams.at(0)?.playerIds ?? [])).toEqual([
        "p1",
        "p2",
      ]);

      // Second team (defenders) should have p3
      expect(demo.teams.at(1)).toMatchObject({ teamId: "defenders" });
      expect(Array.from(demo.teams.at(1)?.playerIds ?? [])).toEqual(["p3"]);
    });

    it("replaces previous team entries on re-sync", () => {
      const target = createScoreboard(GameMode.DEMOLITION);

      const source1: IDemolitionScoreboard = {
        mode: GameMode.DEMOLITION,
        players: [{ playerId: "p1", troops: 5, land: 2, isAlive: true }],
        bombSiteCount: 2,
        plantedAtSite: null,
        detonationTick: null,
        plantProgressTicks: 0,
        defuseProgressTicks: 0,
        defuserId: null,
        isPlanted: false,
        isDefused: false,
        plantDurationTicks: 6,
        defuseDurationTicks: 10,
        detonateDurationTicks: 90,
      };
      syncScoreboard(target, source1, [
        Object.assign(new PublicPlayer(), {
          id: "p1",
          teamId: "t1",
          displayName: "Old",
          color: 1,
          status: PlayerStatus.ACTIVE,
        }),
      ]);
      expect((target as DemolitionScoreboard).teams.length).toBe(1);

      // Re-sync with different players and teams
      const source2: IDemolitionScoreboard = {
        mode: GameMode.DEMOLITION,
        players: [
          { playerId: "p2", troops: 20, land: 8, isAlive: true },
          { playerId: "p3", troops: 15, land: 6, isAlive: true },
        ],
        bombSiteCount: 2,
        plantedAtSite: "B",
        detonationTick: 500,
        plantProgressTicks: 8,
        defuseProgressTicks: 2,
        defuserId: "p2",
        isPlanted: true,
        isDefused: false,
        plantDurationTicks: 6,
        defuseDurationTicks: 10,
        detonateDurationTicks: 90,
      };
      syncScoreboard(target, source2, [
        Object.assign(new PublicPlayer(), {
          id: "p2",
          teamId: "new_attackers",
          displayName: "NewA",
          color: 4,
          status: PlayerStatus.ACTIVE,
        }),
        Object.assign(new PublicPlayer(), {
          id: "p3",
          teamId: "new_defenders",
          displayName: "NewD",
          color: 5,
          status: PlayerStatus.ACTIVE,
        }),
      ]);

      const demo = target as DemolitionScoreboard;
      expect(demo.players.length).toBe(2);
      expect(demo.teams.length).toBe(2);
      expect(demo.players.at(0)?.playerId).toBe("p2");
      expect(demo.players.at(1)?.playerId).toBe("p3");
      // Bomb fields updated
      expect(demo.isPlanted).toBe(true);
      expect(demo.detonationTick).toBe(500);
    });
  });
});
