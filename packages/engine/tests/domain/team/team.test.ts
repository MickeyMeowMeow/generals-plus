import { describe, expect, it } from "vitest";

import { Player } from "../../../src/domain/player/player";
import { ScoringTeam, StandardTeam } from "../../../src/domain/team/team";
import { TeamType } from "../../../src/domain/team/team-type";

describe("Team", () => {
  it("creates standard team with expected defaults", () => {
    const team = new StandardTeam("team-a");

    expect(team.teamId).toBe("team-a");
    expect(team.type).toBe(TeamType.STANDARD);
    expect(team.isEliminated).toBe(false);
    expect(team.players).toEqual([]);
  });

  it("adds and removes players without duplicates", () => {
    const team = new StandardTeam("team-a");
    const p1 = new Player(team, "p1");

    team.addPlayer(p1);
    team.addPlayer(p1);
    expect(team.players).toHaveLength(1);

    team.removePlayer(p1);
    expect(team.players).toHaveLength(0);
  });

  it("creates scoring team with type and score", () => {
    const team = new ScoringTeam(TeamType.SCORER, "score-team");

    expect(team.teamId).toBe("score-team");
    expect(team.type).toBe(TeamType.SCORER);
    expect(team.score).toBe(0);
  });
});