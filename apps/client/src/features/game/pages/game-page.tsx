import type { ISeatReservation } from "@colyseus/sdk/Client";
import type { ICoordinate } from "@generals-plus/engine";
import type {
  MatchState,
  ScoreboardPlayerEntry,
} from "@generals-plus/shared-types";
import { useCallback, useState } from "react";

import { Button } from "#/components/ui/button";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useGameRoom } from "#/features/game/api/use-game-room";
import {
  ErrorPanel,
  FloatingHud,
  LoadingPanel,
} from "#/features/game/components/game-stage";
import { colorToHex } from "#/features/game/components/room-controls";
import { GameApp } from "#/features/game/renderer/game-app";
import type { MoveDirection } from "#/features/game/utils/move";
import { getTargetCoord } from "#/features/game/utils/move";
import { cn } from "#/lib/utils";

export type GamePageSource =
  | {
      type: "official";
      onReturn: () => void;
    }
  | {
      type: "custom";
      setupRoomId: string;
      onReturn: () => void;
    };

interface GamePageProps {
  /** Seat reservation emitted by queue or setup before entering a match room. */
  reservation: ISeatReservation;
  /** Return behavior and metadata for the flow that launched the match. */
  source: GamePageSource;
}

function getModeLabel(mode: string | undefined) {
  return GAME_MODE_OPTIONS.find((option) => option.id === mode)?.label ?? mode;
}

function getScoreEntries(gameState: MatchState | null) {
  const players = (
    gameState?.scoreboard as
      | { players?: Iterable<ScoreboardPlayerEntry> }
      | undefined
  )?.players;

  return players
    ? Array.from(players, (entry) => ({
        playerId: entry.playerId,
        land: entry.land,
        troops: entry.troops,
      }))
    : [];
}

/**
 * Match view rendered after queue/setup hands the client a seat reservation.
 *
 * The page delegates socket ownership and state adaptation to `useGameRoom`,
 * keeps local-only selection state for map input, and renders the Pixi board
 * with the floating match HUD. It is intentionally route-agnostic so both `/`
 * official matches and `/match/:roomId` custom matches can reuse the same game
 * surface after their respective seat-reservation handoff.
 */
export function GamePage({ reservation, source }: GamePageProps) {
  const {
    room,
    renderGrid,
    moveQueue,
    gameState,
    gameResult,
    sendMove,
    playerColors,
    connectionStatus,
    error,
    isConnecting,
  } = useGameRoom(reservation);

  const [selection, setSelection] = useState<ICoordinate | null>(null);

  const handleSelectCell = useCallback((coord: ICoordinate) => {
    setSelection(coord);
  }, []);

  const handleQueueMove = useCallback(
    (direction: MoveDirection) => {
      if (!selection || !room) return;
      const from = selection;
      const to = getTargetCoord({ from, direction });

      setSelection(to);
      sendMove(from, to);
    },
    [selection, room, sendMove],
  );

  if (error) return <ErrorPanel message={error} />;

  if (isConnecting || !gameState) {
    return <LoadingPanel message="Connecting to match" />;
  }

  if (!renderGrid) return <LoadingPanel message="Loading battlefield" />;

  const scoreByPlayer = new Map(
    getScoreEntries(gameState).map((entry) => [entry.playerId, entry]),
  );
  const players = Array.from(gameState.players.values())
    .map((player) => {
      const score = scoreByPlayer.get(player.id);
      return {
        id: player.id,
        displayName: player.displayName,
        teamId: player.teamId,
        color: player.color ?? playerColors.get(player.id) ?? 0,
        land: score?.land ?? 0,
        troops: score?.troops ?? 0,
        isCurrent: player.sessionId === room?.sessionId,
      };
    })
    .sort(
      (a, b) =>
        b.troops - a.troops || a.displayName.localeCompare(b.displayName),
    );
  const currentPlayer = players.find((player) => player.isCurrent);
  const winner = gameResult?.winnerTeamId
    ? players.find((player) => player.teamId === gameResult.winnerTeamId)
    : null;
  const didWin = Boolean(
    gameResult?.winnerTeamId &&
      currentPlayer?.teamId === gameResult.winnerTeamId,
  );
  const shareUrl =
    source.type === "custom"
      ? typeof window === "undefined"
        ? `/match/${source.setupRoomId}`
        : `${window.location.origin}/match/${source.setupRoomId}`
      : null;

  return (
    <div className="fixed inset-0 z-20 bg-game-bg">
      <GameApp
        grid={renderGrid}
        selection={selection}
        moveQueue={moveQueue}
        onSelectCell={handleSelectCell}
        onQueueMove={handleQueueMove}
        playerColors={playerColors}
      />

      <FloatingHud>
        <div className="space-y-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-game-text-dim">Mode</span>
              <span>{getModeLabel(gameState.mode)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-game-text-dim">Connection</span>
              <span>{connectionStatus}</span>
            </div>
            {shareUrl ? (
              <div className="grid gap-1">
                <span className="text-game-text-dim">Share</span>
                <span className="break-all font-mono text-xs">{shareUrl}</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold">Players</h2>
            <ul className="space-y-1.5">
              {players.map((player) => (
                <li
                  key={player.id}
                  className={cn(
                    "grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-sm",
                    player.isCurrent && "font-semibold",
                  )}
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: colorToHex(player.color) }}
                  />
                  <span className="truncate">{player.displayName}</span>
                  <span className="tabular-nums text-game-text-dim">
                    {player.land}
                  </span>
                  <span className="tabular-nums">{player.troops}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </FloatingHud>

      {gameResult ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-result-title"
            className="game-panel w-full max-w-sm rounded-lg p-5"
          >
            <h2 id="game-result-title" className="text-2xl font-semibold">
              {didWin ? "You won" : winner ? "You lost" : "Game over"}
            </h2>
            <div className="mt-3 space-y-1 text-sm text-game-text-dim">
              <p>Mode: {getModeLabel(gameResult.mode)}</p>
              {!didWin && winner ? <p>Winner: {winner.displayName}</p> : null}
              {!gameResult.winnerTeamId ? <p>No winner was reported.</p> : null}
            </div>
            <Button type="button" onClick={source.onReturn} className="mt-5">
              {source.type === "official"
                ? "Return to lobby"
                : "Return to setup room"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
