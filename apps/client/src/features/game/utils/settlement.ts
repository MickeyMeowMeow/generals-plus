import { GameStatus, PlayerStatus } from "@generals-plus/engine";

import type { RenderScoreboardData } from "#/features/game/renderer/scoreboard-types";

export const SettlementDialogKind = {
  ELIMINATED: "eliminated",
  GAME_ENDED: "game-ended",
} as const;

export type SettlementDialogKind =
  (typeof SettlementDialogKind)[keyof typeof SettlementDialogKind];

export const SettlementRoute = {
  LOBBY: "/lobby",
} as const;

export const SettlementText = {
  eliminatedTitle: "你已阵亡",
  eliminatedDescription: "你可以退出本局，或继续观战直到游戏结束。",
  gameEndedTitle: "游戏结束",
  gameEndedDescription: "本局已结束。",
  winnerDescriptionPrefix: "获胜者：",
  exitAction: "退出",
  spectateAction: "观战",
} as const;

export interface SettlementPromptState {
  readonly isEliminated: boolean;
  readonly isFinished: boolean;
  readonly isSpectating: boolean;
  readonly hasSeenEliminationPrompt: boolean;
}

export class SettlementPresenter {
  static resolveDialogKind({
    isEliminated,
    isFinished,
    isSpectating,
    hasSeenEliminationPrompt,
  }: SettlementPromptState): SettlementDialogKind | null {
    // Once the match ends we always switch to the final settlement dialog,
    // even if the player was previously sitting on the elimination prompt.
    if (isFinished) return SettlementDialogKind.GAME_ENDED;
    if (isEliminated && !isSpectating && !hasSeenEliminationPrompt) {
      return SettlementDialogKind.ELIMINATED;
    }
    return null;
  }

  static getWinnerName(
    scoreboard: RenderScoreboardData | null,
    winnerTeamId: string | null,
  ): string | null {
    // Prefer the authoritative result when team ids are available, then fall
    // back to the best client-side ranking snapshot to keep the dialog usable
    // around disconnect boundaries.
    const resultWinner = scoreboard?.rows.find(
      (row) => row.teamId === winnerTeamId,
    );
    if (resultWinner) return resultWinner.displayName;

    const activeWinner = scoreboard?.rows.find(
      (row) => row.status === PlayerStatus.ACTIVE,
    );
    if (activeWinner) return activeWinner.displayName;

    const rankedWinner = scoreboard?.rows[0];
    if (rankedWinner) return rankedWinner.displayName;

    return null;
  }

  static isFinished(status: GameStatus | string | undefined): boolean {
    return status === GameStatus.FINISHED;
  }
}
