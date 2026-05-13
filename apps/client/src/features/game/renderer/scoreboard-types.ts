import type { GameMode, PlayerStatus } from "@generals-plus/engine";

export type ScoreboardBaseFields<TMode> = {
  readonly mode: TMode;
  readonly playerId: string;
  readonly displayName: string;
  readonly teamId?: string;
  readonly color: number;
  readonly status: PlayerStatus | string;
  readonly isCurrentPlayer: boolean;
};

export type ScoreboardEntry<TMode, TFields> = ScoreboardBaseFields<TMode> &
  TFields;

export type ClassicScoreboardEntry = ScoreboardEntry<
  typeof GameMode.CLASSIC,
  {
    readonly troops: number;
    readonly land: number;
    readonly isGeneralAlive: boolean;
  }
>;

export type RenderScoreboardEntry = ClassicScoreboardEntry;

export type RenderScoreboardData = {
  readonly mode: GameMode;
  readonly rows: readonly RenderScoreboardEntry[];
};
