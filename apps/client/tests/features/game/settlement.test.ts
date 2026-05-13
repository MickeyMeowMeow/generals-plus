import { GameMode, GameStatus, PlayerStatus } from "@generals-plus/engine";
import { describe, expect, it } from "vitest";

import type { RenderScoreboardData } from "#/features/game/renderer/scoreboard-types";
import {
  SettlementDialogKind,
  SettlementPresenter,
} from "#/features/game/utils/settlement";

const PlayerColor = {
  alpha: 0xff0000,
  beta: 0x00ff00,
} as const;

const ScoreboardFixture: RenderScoreboardData = {
  mode: GameMode.CLASSIC,
  rows: [
    {
      mode: GameMode.CLASSIC,
      playerId: "p2",
      displayName: "Beta",
      teamId: "team_1",
      color: PlayerColor.beta,
      status: PlayerStatus.ELIMINATED,
      isCurrentPlayer: false,
      troops: 10,
      land: 5,
      isGeneralAlive: false,
    },
    {
      mode: GameMode.CLASSIC,
      playerId: "p1",
      displayName: "Alpha",
      teamId: "team_0",
      color: PlayerColor.alpha,
      status: PlayerStatus.ACTIVE,
      isCurrentPlayer: true,
      troops: 8,
      land: 4,
      isGeneralAlive: true,
    },
  ],
};

describe("SettlementPresenter", () => {
  it("prioritizes game-ended dialog over eliminated dialog", () => {
    const kind = SettlementPresenter.resolveDialogKind({
      isEliminated: true,
      isFinished: true,
      isSpectating: false,
      hasSeenEliminationPrompt: false,
    });

    expect(kind).toBe(SettlementDialogKind.GAME_ENDED);
  });

  it("does not reopen eliminated dialog after spectating", () => {
    const kind = SettlementPresenter.resolveDialogKind({
      isEliminated: true,
      isFinished: false,
      isSpectating: true,
      hasSeenEliminationPrompt: true,
    });

    expect(kind).toBeNull();
  });

  it("prefers active scoreboard row as winner display name", () => {
    expect(SettlementPresenter.getWinnerName(ScoreboardFixture, null)).toBe(
      "Alpha",
    );
  });

  it("uses winner team id when game result is available", () => {
    expect(SettlementPresenter.getWinnerName(ScoreboardFixture, "team_1")).toBe(
      "Beta",
    );
  });

  it("detects finished game status", () => {
    expect(SettlementPresenter.isFinished(GameStatus.FINISHED)).toBe(true);
  });
});
