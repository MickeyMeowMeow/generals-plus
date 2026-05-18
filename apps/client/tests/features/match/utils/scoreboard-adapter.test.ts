import { GameMode } from "@generals-plus/engine";
import {
  ClassicScoreboard,
  ClassicScoreboardPlayerEntry,
  Player,
} from "@generals-plus/shared-types";
import { describe, expect, it } from "vitest";

import { createMatchHudScoreboardModel } from "#/features/match/utils/scoreboard-adapter";

/**
 * Creates a Colyseus player schema fixture with overridable identity fields.
 */
function player(overrides: Partial<Player> = {}): Player {
  const value = new Player();
  value.id = "p1";
  value.displayName = "Nova";
  value.teamId = "t1";
  value.color = 0xff0000;
  value.sessionId = "s1";
  Object.assign(value, overrides);
  return value;
}

/**
 * Creates one scoreboard player entry using the real shared schema class.
 */
function playerScore({
  playerId,
  troops,
  land,
}: {
  playerId: string;
  troops: number;
  land: number;
}) {
  const value = new ClassicScoreboardPlayerEntry();
  value.playerId = playerId;
  value.troops = troops;
  value.land = land;
  return value;
}

/**
 * Creates a Classic scoreboard fixture with one player score.
 */
function classicScoreboard() {
  const scoreboard = new ClassicScoreboard();
  scoreboard.mode = GameMode.CLASSIC;
  scoreboard.players.push(playerScore({ playerId: "p1", troops: 12, land: 4 }));
  return scoreboard;
}

/**
 * Creates a Domination-like scoreboard fixture without requiring shared schema changes.
 */
function dominationScoreboard() {
  const scoreboard = Object.assign(new ClassicScoreboard(), {
    teamScores: new Map([
      ["t1", 30],
      ["t2", 10],
    ]),
  });
  scoreboard.mode = GameMode.DOMINATION;
  scoreboard.players.push(
    playerScore({ playerId: "p1", troops: 12, land: 4 }),
    playerScore({ playerId: "p2", troops: 8, land: 3 }),
  );
  return scoreboard;
}

describe("createMatchHudScoreboardModel", () => {
  it("adapts classic troop-land scoreboard rows", () => {
    const model = createMatchHudScoreboardModel({
      scoreboard: classicScoreboard(),
      visiblePlayers: [player()],
      playerColors: new Map(),
      playerNames: new Map(),
      currentSessionId: "s1",
    });

    expect(model.title).toBe("Players");
    expect(model.columns.map((column) => column.key)).toEqual([
      "land",
      "troops",
    ]);
    expect(model.groups.at(0)?.rows.at(0)).toMatchObject({
      id: "p1",
      label: "Nova",
      isCurrent: true,
      values: { land: 4, troops: 12 },
    });
  });

  it("adapts domination team scores when present", () => {
    const model = createMatchHudScoreboardModel({
      scoreboard: dominationScoreboard(),
      visiblePlayers: [
        player({ id: "p1", displayName: "Nova", teamId: "t1" }),
        player({
          id: "p2",
          displayName: "Rook",
          teamId: "t2",
          color: 0x00ff00,
          sessionId: "s2",
        }),
      ],
      playerColors: new Map(),
      playerNames: new Map(),
      currentSessionId: "s1",
    });

    expect(model.title).toBe("Teams");
    expect(model.columns.map((column) => column.key)).toEqual([
      "score",
      "land",
      "troops",
    ]);
    expect(model.groups.at(0)).toMatchObject({
      id: "t1",
      totals: { score: 30, land: 4, troops: 12 },
    });
    expect(model.groups.at(0)?.rows.at(0)?.values).toEqual({
      score: "",
      land: 4,
      troops: 12,
    });
  });
});
