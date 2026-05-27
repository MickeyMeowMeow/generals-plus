import {
  DemolitionGame,
  DominationGame,
  GameMode,
  TurfWarGame,
} from "@generals-plus/engine";
import { describe, expect, it } from "vitest";

import { createGame, generateSeed } from "#/features/game/utils";

describe("generateSeed", () => {
  it("returns a number", () => {
    const seed = generateSeed();
    expect(typeof seed).toBe("number");
    expect(Number.isFinite(seed)).toBe(true);
  });

  it("returns a 32-bit unsigned integer", () => {
    for (let i = 0; i < 100; i++) {
      const seed = generateSeed();
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
      // After >>> 0 the value should be unchanged — already unsigned 32-bit.
      expect(seed >>> 0).toBe(seed);
    }
  });

  it("produces different values on successive calls", () => {
    // Generate many seeds — they should not all be identical.
    const seeds = Array.from({ length: 20 }, () => generateSeed());
    const unique = new Set(seeds);
    // Allow for extremely unlikely collision (1-2 duplicates in 20) but not all.
    expect(unique.size).toBeGreaterThan(1);
  });

  it("produces valid seeds usable by grid generation", () => {
    // Seeds must be integers that the engine's SeededRandom can accept.
    for (let i = 0; i < 50; i++) {
      const seed = generateSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("createGame", () => {
  it("creates a ClassicGame with correct teams and players", () => {
    const game = createGame({
      mode: GameMode.CLASSIC,
      playerIds: ["p1", "p2"],
      playerPerTeam: 1,
    });

    expect(game.mode).toBe(GameMode.CLASSIC);
    expect(game.players.size).toBe(2);
    expect(game.teams.size).toBe(2);
    expect(game.players.has("p1")).toBe(true);
    expect(game.players.has("p2")).toBe(true);
  });

  it("assigns players to teams evenly", () => {
    const game = createGame({
      mode: GameMode.CLASSIC,
      playerIds: ["p1", "p2", "p3", "p4"],
      playerPerTeam: 2,
    });

    expect(game.teams.size).toBe(2);
    expect(game.players.size).toBe(4);

    const team0 = game.teams.get("team_0");
    const team1 = game.teams.get("team_1");
    expect(team0?.players.length).toBe(2);
    expect(team1?.players.length).toBe(2);
  });

  it("creates a TurfWarGame with custom finishTick", () => {
    const game = createGame({
      mode: GameMode.TURF_WAR,
      playerIds: ["p1", "p2"],
      playerPerTeam: 1,
      finishTick: 100,
    });

    expect(game).toBeInstanceOf(TurfWarGame);
    expect(game.players.size).toBe(2);
    // Verify finishTick is applied by checking maxTicks via tick behavior
    // @ts-expect-error - bypassing private modifier
    expect(game.maxTicks).toBe(100);
  });

  it("creates a TurfWarGame with default finishTick when omitted", () => {
    const game = createGame({
      mode: GameMode.TURF_WAR,
      playerIds: ["p1", "p2"],
      playerPerTeam: 1,
    });

    expect(game).toBeInstanceOf(TurfWarGame);
    // @ts-expect-error - bypassing private modifier
    expect(game.maxTicks).toBe(360);
  });

  it("throws if team not found during classic player assignment", () => {
    const originalSet = Map.prototype.set;
    Map.prototype.set = function () {
      return this;
    };

    try {
      expect(() =>
        createGame({
          mode: GameMode.CLASSIC,
          playerIds: ["p1"],
          playerPerTeam: 1,
        }),
      ).toThrow('Team with id "team_0" not found for player "p1".');
    } finally {
      Map.prototype.set = originalSet;
    }
  });

  it("throws if team not found during turf war player assignment", () => {
    const originalSet = Map.prototype.set;
    Map.prototype.set = function () {
      return this;
    };

    try {
      expect(() =>
        createGame({
          mode: GameMode.TURF_WAR,
          playerIds: ["p1"],
          playerPerTeam: 1,
        }),
      ).toThrow('Team with id "team_0" not found for player "p1".');
    } finally {
      Map.prototype.set = originalSet;
    }
  });

  it("throws for unsupported game mode", () => {
    expect(() =>
      createGame({
        mode: "unsupported_mode" as GameMode,
        playerIds: ["p1", "p2"],
        playerPerTeam: 1,
      }),
    ).toThrow('Game mode "unsupported_mode" is not implemented yet.');
  });

  describe("domination mode", () => {
    it("creates a DominationGame with correct teams and players", () => {
      const game = createGame({
        mode: GameMode.DOMINATION,
        playerIds: ["p1", "p2", "p3", "p4"],
        playerPerTeam: 2,
      });

      expect(game).toBeInstanceOf(DominationGame);
      expect(game.mode).toBe(GameMode.DOMINATION);
      expect(game.players.size).toBe(4);
      expect(game.teams.size).toBe(2);
    });

    it("passes grid options including flagCount", () => {
      const game = createGame({
        mode: GameMode.DOMINATION,
        gridOptions: { generalCount: 2, flagCount: 3 },
        playerIds: ["p1", "p2"],
        playerPerTeam: 1,
      });

      expect(game).toBeInstanceOf(DominationGame);
      expect(game.players.size).toBe(2);
    });

    it("passes targetScore to DominationGame", () => {
      const game = createGame({
        mode: GameMode.DOMINATION,
        playerIds: ["p1", "p2"],
        playerPerTeam: 1,
        finishTick: 200,
        targetScore: 500,
      });

      expect(game).toBeInstanceOf(DominationGame);
      expect((game as DominationGame).targetScore).toBe(500);
      // @ts-expect-error - bypassing private modifier
      expect(game.maxTicks).toBe(200);
    });

    it("uses default targetScore when omitted for DominationGame", () => {
      const game = createGame({
        mode: GameMode.DOMINATION,
        playerIds: ["p1", "p2"],
        playerPerTeam: 1,
      });

      expect((game as DominationGame).targetScore).toBe(1000);
    });

    it("throws if team not found during player assignment", () => {
      const originalSet = Map.prototype.set;
      Map.prototype.set = function () {
        return this;
      };

      try {
        expect(() =>
          createGame({
            mode: GameMode.DOMINATION,
            playerIds: ["p1"],
            playerPerTeam: 1,
          }),
        ).toThrow('Team with id "team_0" not found for player "p1".');
      } finally {
        Map.prototype.set = originalSet;
      }
    });
  });

  describe("demolition mode", () => {
    it("creates a DemolitionGame with attackers and defenders teams", () => {
      const game = createGame({
        mode: GameMode.DEMOLITION,
        playerIds: ["p1", "p2", "p3", "p4"],
        playerPerTeam: 2,
        finishTick: 240,
        plantDurationTicks: 8,
        defuseDurationTicks: 12,
        detonateDurationTicks: 60,
        bombSiteCount: 3,
        seed: 12345,
      });

      expect(game).toBeInstanceOf(DemolitionGame);
      expect(game.mode).toBe(GameMode.DEMOLITION);
      expect(game.players.size).toBe(4);
      expect(game.teams.size).toBe(2);
      expect(game.teams.has("attackers")).toBe(true);
      expect(game.teams.has("defenders")).toBe(true);

      const attackers = game.teams.get("attackers");
      const defenders = game.teams.get("defenders");
      expect(attackers?.players.length).toBe(2);
      expect(defenders?.players.length).toBe(2);

      const demo = game as DemolitionGame;
      expect(demo.maxTicks).toBe(240);
      expect(demo.plantDuration).toBe(4);
      expect(demo.defuseDuration).toBe(6);
      expect(demo.detonateDuration).toBe(30);
      expect(demo.bombSiteCount).toBe(3);
      expect(demo.seed).toBe(12345);
    });
  });
});
