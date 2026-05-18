import { GameMode } from "@generals-plus/engine";
import {
  ClassicScoreboard,
  ClassicScoreboardPlayerEntry,
  TroopLandScoreboardPlayerEntry,
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

});
