import { describe, expect, it } from "vitest";

import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";

describe("Player", () => {
  it("uses active as default status", () => {
    const team = new StandardTeam("team-a");
    const player = new Player(team, "player-1");

    expect(player.playerId).toBe("player-1");
    expect(player.team).toBe(team);
    expect(player.status).toBe(PlayerStatus.ACTIVE);
  });

  it("accepts explicit initial status", () => {
    const team = new StandardTeam("team-a");
    const player = new Player(team, "player-2", PlayerStatus.ELIMINATED);

    expect(player.status).toBe(PlayerStatus.ELIMINATED);
  });
});
