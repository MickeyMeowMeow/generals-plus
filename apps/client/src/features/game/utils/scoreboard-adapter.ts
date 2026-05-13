import { GameMode, PlayerStatus } from "@generals-plus/engine";
import type {
  ClassicScoreboard,
  MatchState,
} from "@generals-plus/shared-types";

import type {
  ClassicScoreboardEntry,
  RenderScoreboardData,
} from "#/features/game/renderer/scoreboard-types";

function compareClassicRows(
  left: ClassicScoreboardEntry,
  right: ClassicScoreboardEntry,
): number {
  // Match the familiar in-game ordering: living players first, then sort by
  // board impact before falling back to a stable name comparison.
  if (left.status !== right.status) {
    if (left.status === PlayerStatus.ACTIVE) return -1;
    if (right.status === PlayerStatus.ACTIVE) return 1;
  }

  if (left.troops !== right.troops) return right.troops - left.troops;
  if (left.land !== right.land) return right.land - left.land;
  return left.displayName.localeCompare(right.displayName);
}

export const scoreboardAdapter = {
  fromMatchState(
    state: MatchState,
    currentUserId: string | null,
  ): RenderScoreboardData | null {
    if (state.scoreboard.mode !== GameMode.CLASSIC) return null;

    const scoreboard = state.scoreboard as ClassicScoreboard;

    const rows = scoreboard.players.map((score) => {
      const publicPlayer = state.publicPlayers.get(score.playerId);

      return {
        mode: GameMode.CLASSIC,
        playerId: score.playerId,
        displayName: publicPlayer?.displayName ?? score.playerId,
        ...(publicPlayer ? { teamId: publicPlayer.teamId } : {}),
        color: publicPlayer?.color ?? 0x8b949e,
        // Older snapshots may briefly lack public metadata, so fall back to the
        // scoreboard payload to keep the overlay renderable.
        status:
          publicPlayer?.status ??
          (score.isGeneralAlive
            ? PlayerStatus.ACTIVE
            : PlayerStatus.ELIMINATED),
        isCurrentPlayer: score.playerId === currentUserId,
        troops: score.troops,
        land: score.land,
        isGeneralAlive: score.isGeneralAlive,
      } satisfies ClassicScoreboardEntry;
    });

    return {
      mode: GameMode.CLASSIC,
      rows: rows.sort(compareClassicRows),
    };
  },
};
