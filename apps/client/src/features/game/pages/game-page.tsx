import type { ISeatReservation } from "@colyseus/sdk/Client";
import type { ICoordinate } from "@generals-plus/engine";
import { useCallback, useState } from "react";

import { ErrorPanel, LoadingPanel, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useGameRoom } from "#/features/game/api/use-game-room";
import { GameApp } from "#/features/game/renderer/game-app";
import type { MoveDirection } from "#/features/game/utils/move";
import { getTargetCoord } from "#/features/game/utils/move";
import { MatchHud } from "#/features/match/components/match-hud";

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
    return (
      <StageCenter>
        <LoadingPanel message="Connecting to match" />
      </StageCenter>
    );
  }

  if (!renderGrid)
    return (
      <StageCenter>
        <LoadingPanel message="Loading battlefield" />
      </StageCenter>
    );

  const visiblePlayers = Array.from(gameState.players.values());
  const currentPlayer = visiblePlayers.find(
    (player) => player.sessionId === room?.sessionId,
  );
  const winner = gameResult?.winnerTeamId
    ? visiblePlayers.find((player) => player.teamId === gameResult.winnerTeamId)
    : null;
  const didWin = Boolean(
    gameResult?.winnerTeamId &&
      currentPlayer?.teamId === gameResult.winnerTeamId,
  );

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

      <MatchHud
        modeLabel={getModeLabel(gameState.mode)}
        connectionStatus={connectionStatus}
        scoreboard={gameState.scoreboard}
        visiblePlayers={visiblePlayers}
        playerColors={playerColors}
        currentSessionId={room?.sessionId}
      />

      {gameResult ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-result-title"
            className="game-panel w-full max-w-sm rounded-none p-5"
          >
            <h2 id="game-result-title" className="text-2xl font-semibold">
              {didWin ? "You won" : winner ? "You lost" : "Game over"}
            </h2>
            <div className="mt-3 space-y-1 text-sm text-game-text-dim">
              <p>Mode: {getModeLabel(gameResult.mode)}</p>
              {!didWin && winner?.displayName ? (
                <p>Winner: {winner.displayName}</p>
              ) : null}
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
