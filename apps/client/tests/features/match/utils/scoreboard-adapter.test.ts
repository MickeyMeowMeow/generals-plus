import { GameMode } from "@generals-plus/engine";
import {
  ClassicScoreboard,
  ClassicScoreboardPlayerEntry,
  TroopLandScoreboardPlayerEntry,
  TurfWarScoreboard,
  TurfWarScoreboardPlayerEntry,
  TurfWarScoreboardTeamEntry,
} from "@generals-plus/shared-types";
import { describe, expect, it } from "vitest";

import { createGameHudScoreboardModel } from "#/features/match/utils/scoreboard-adapter";

/**
 * Creates one scoreboard player entry using the real shared schema class.
 */
function playerScore({
  playerId,
  teamId = "t1",
  displayName = "Nova",
  color = 0xff0000,
  troops,
  land,
}: {
  playerId: string;
  teamId?: string;
  displayName?: string;
  color?: number;
  troops: number;
  land: number;
}): TroopLandScoreboardPlayerEntry {
  const value = new TroopLandScoreboardPlayerEntry();
  value.playerId = playerId;
  value.teamId = teamId;
  value.displayName = displayName;
  value.color = color;
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
  const score = playerScore({ playerId: "p1", troops: 12, land: 4 });
  const classicScore = new ClassicScoreboardPlayerEntry();
  Object.assign(classicScore, score, { isAlive: true });
  scoreboard.players.push(classicScore);
  return scoreboard;
}

/**
 * Creates a Turf War scoreboard fixture with two teams and players.
 */
function turfWarScoreboard() {
  const scoreboard = new TurfWarScoreboard();
  scoreboard.mode = GameMode.TURF_WAR;

  // Add players
  const p1 = playerScore({
    playerId: "p1",
    teamId: "t1",
    displayName: "Nova",
    troops: 10,
    land: 5,
  });
  const entry1 = new TurfWarScoreboardPlayerEntry();
  Object.assign(entry1, p1, { isAlive: true });

  const p2 = playerScore({
    playerId: "p2",
    teamId: "t2",
    displayName: "Astra",
    troops: 8,
    land: 3,
  });
  const entry2 = new TurfWarScoreboardPlayerEntry();
  Object.assign(entry2, p2, { isAlive: true });

  scoreboard.players.push(entry1, entry2);

  // Add teams
  const team1 = new TurfWarScoreboardTeamEntry();
  team1.teamId = "t1";
  team1.landPercent = 63;
  team1.playerIds.push("p1");

  const team2 = new TurfWarScoreboardTeamEntry();
  team2.teamId = "t2";
  team2.landPercent = 37;
  team2.playerIds.push("p2");

  scoreboard.teams.push(team1, team2);

  return scoreboard;
}

describe("createGameHudScoreboardModel", () => {
  it("adapts classic troop-land scoreboard rows", () => {
    const model = createGameHudScoreboardModel(classicScoreboard());

    expect(model.title).toBe("Players");
    expect(model.columns.map((column) => column.key)).toEqual([
      "land",
      "troops",
    ]);
    expect(model.groups.at(0)?.rows.at(0)).toMatchObject({
      id: "p1",
      label: "Nova",
      values: { land: 4, troops: 12 },
    });
  });

  it("adapts turf war scoreboard rows grouped by team with percentage", () => {
    const model = createGameHudScoreboardModel(turfWarScoreboard());

    expect(model.title).toBe("Teams");
    expect(model.columns.map((column) => column.key)).toEqual([
      "land",
      "troops",
    ]);

    expect(model.groups).toHaveLength(2);

    // Sorted descending by percentage (63% first, then 37%)
    const g1 = model.groups[0];
    expect(g1.id).toBe("t1");
    expect(g1.label).toBe("Team t1 (63%)");
    expect(g1.rows[0]).toMatchObject({
      id: "p1",
      label: "Nova",
      values: { land: 5, troops: 10 },
    });

    const g2 = model.groups[1];
    expect(g2.id).toBe("t2");
    expect(g2.label).toBe("Team t2 (37%)");
    expect(g2.rows[0]).toMatchObject({
      id: "p2",
      label: "Astra",
      values: { land: 3, troops: 8 },
    });
  });
});
