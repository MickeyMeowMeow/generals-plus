import { GameMode, TurfWarGame } from "@generals-plus/engine";
import { describe, expect, it } from "vitest";

import { createGame } from "#/features/game/utils";

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
        mode: "demolition" as GameMode,
        playerIds: ["p1", "p2"],
        playerPerTeam: 1,
      }),
    ).toThrow('Game mode "demolition" is not implemented yet.');
  });
});
