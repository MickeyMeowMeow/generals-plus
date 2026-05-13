import { GameMode, PlayerStatus } from "@generals-plus/engine";
import {
  ClassicScoreboard,
  ClassicScoreboardPlayerEntry,
  MatchState,
  PublicPlayer,
} from "@generals-plus/shared-types";
import { describe, expect, it } from "vitest";

import { scoreboardAdapter } from "#/features/game/utils/scoreboard-adapter";

function createPublicPlayer({
  id,
  displayName,
  color,
  teamId,
  status,
}: {
  id: string;
  displayName: string;
  color: number;
  teamId: string;
  status: PlayerStatus;
}) {
  const player = new PublicPlayer();
  player.id = id;
  player.displayName = displayName;
  player.color = color;
  player.teamId = teamId;
  player.status = status;
  return player;
}

function createScoreEntry({
  playerId,
  troops,
  land,
  isGeneralAlive,
}: {
  playerId: string;
  troops: number;
  land: number;
  isGeneralAlive: boolean;
}) {
  const entry = new ClassicScoreboardPlayerEntry();
  entry.playerId = playerId;
  entry.troops = troops;
  entry.land = land;
  entry.isGeneralAlive = isGeneralAlive;
  return entry;
}

describe("scoreboardAdapter", () => {
  it("adapts classic server scoreboard with public player metadata", () => {
    const state = new MatchState();
    const scoreboard = new ClassicScoreboard();
    state.mode = GameMode.CLASSIC;
    state.scoreboard = scoreboard;
    scoreboard.mode = GameMode.CLASSIC;
    state.publicPlayers.set(
      "p1",
      createPublicPlayer({
        id: "p1",
        displayName: "Alpha",
        color: 0xff0000,
        teamId: "team_0",
        status: PlayerStatus.ACTIVE,
      }),
    );
    state.publicPlayers.set(
      "p2",
      createPublicPlayer({
        id: "p2",
        displayName: "Beta",
        color: 0x00ff00,
        teamId: "team_1",
        status: PlayerStatus.ELIMINATED,
      }),
    );
    scoreboard.players.push(
      createScoreEntry({
        playerId: "p2",
        troops: 99,
        land: 30,
        isGeneralAlive: false,
      }),
    );
    scoreboard.players.push(
      createScoreEntry({
        playerId: "p1",
        troops: 8,
        land: 5,
        isGeneralAlive: true,
      }),
    );

    const result = scoreboardAdapter.fromMatchState(state, "p1");

    expect(result?.mode).toBe(GameMode.CLASSIC);
    expect(result?.rows).toEqual([
      {
        mode: GameMode.CLASSIC,
        playerId: "p1",
        displayName: "Alpha",
        color: 0xff0000,
        status: PlayerStatus.ACTIVE,
        isCurrentPlayer: true,
        troops: 8,
        land: 5,
        isGeneralAlive: true,
      },
      {
        mode: GameMode.CLASSIC,
        playerId: "p2",
        displayName: "Beta",
        color: 0x00ff00,
        status: PlayerStatus.ELIMINATED,
        isCurrentPlayer: false,
        troops: 99,
        land: 30,
        isGeneralAlive: false,
      },
    ]);
  });

  it("falls back to playerId and default color when public metadata is missing", () => {
    const state = new MatchState();
    const scoreboard = new ClassicScoreboard();
    state.mode = GameMode.CLASSIC;
    state.scoreboard = scoreboard;
    scoreboard.mode = GameMode.CLASSIC;
    scoreboard.players.push(
      createScoreEntry({
        playerId: "p9",
        troops: 4,
        land: 2,
        isGeneralAlive: true,
      }),
    );

    const result = scoreboardAdapter.fromMatchState(state, null);

    expect(result?.rows).toEqual([
      {
        mode: GameMode.CLASSIC,
        playerId: "p9",
        displayName: "p9",
        color: 0x8b949e,
        status: PlayerStatus.ACTIVE,
        isCurrentPlayer: false,
        troops: 4,
        land: 2,
        isGeneralAlive: true,
      },
    ]);
  });
});
