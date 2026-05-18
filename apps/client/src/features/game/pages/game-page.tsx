import type { ICoordinate } from "@generals-plus/engine";
import { ActionType, PlayerStatus } from "@generals-plus/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { ErrorPanel, LoadingPanel, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import type { GameRoomConnection } from "#/features/game/api/use-game-room";
import {
  clearPersistedGameSession,
  useGameRoom,
} from "#/features/game/api/use-game-room";
import { GameHud } from "#/features/game/components/game-hud";
import { GameApp } from "#/features/game/renderer/game-app";
import { isCoordInBounds, isSameCoord } from "#/features/game/utils/coord";
import type { MoveDirection } from "#/features/game/utils/move";
import { getTargetCoord } from "#/features/game/utils/move";

export type GamePageSource =
  | {
      /** Official queue flow rendered on the root route. */
      type: "official";
      /** Returns from a finished/failed official match to the lobby. */
      onReturn: () => void;
    }
  | {
      /** Custom setup flow rendered from `/match/:roomId`. */
      type: "custom";
      /** Stable custom room URL key used to scope persisted match recovery. */
      customRoomKey: string;
      /** Returns from a finished custom match to its setup route. */
      onReturn: () => void;
    };

interface GamePageProps {
  /** Seat reservation or recovery token used to enter the match room. */
  connection: GameRoomConnection;
  /** Return behavior and metadata for the flow that launched the match. */
  source: GamePageSource;
  /** Optional hook for routes that should abandon a stale recovery path. */
  onRecoveryFailed?: () => void;
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
export function GamePage({
  connection,
  source,
  onRecoveryFailed,
}: GamePageProps) {
  const navigate = useNavigate();
  /**
   * Keep the full connection payload stable across parent re-renders.
   *
   * Queue/setup parents create fresh object literals while rendering. We key
   * them by primitive identity fields but keep the original reservation object
   * intact, because Colyseus may attach SDK-specific fields beyond the visible
   * `{ name, roomId, sessionId }` tuple.
   */
  const connectionKey =
    connection.type === "reservation"
      ? `reservation:${connection.reservation.name}:${connection.reservation.roomId}:${connection.reservation.sessionId}`
      : `recovery:${connection.recoveryToken}`;
  const stableConnectionRef = useRef<{
    key: string;
    value: GameRoomConnection;
  } | null>(null);
  if (stableConnectionRef.current?.key !== connectionKey) {
    stableConnectionRef.current = { key: connectionKey, value: connection };
  }
  const stableConnection = stableConnectionRef.current.value;
  const customRoomKey = source.type === "custom" ? source.customRoomKey : null;
  const hasHandledRecoveryFailureRef = useRef(false);

  /**
   * Memoized route context persisted alongside the recovery token.
   */
  const persistedSource = useMemo(
    () =>
      source.type === "official"
        ? { type: "official" as const }
        : { type: "custom" as const, customRoomKey: customRoomKey ?? "" },
    [source.type, customRoomKey],
  );
  const {
    room,
    renderGrid,
    moveQueue,
    gameState,
    gameResult,
    sendMove,
    clearMoveQueue,
    playerColors,
    playerNames,
    error,
    isConnecting,
  } = useGameRoom(stableConnection, persistedSource);

  const [selection, setSelection] = useState<ICoordinate | null>(null);
  const [splitMoveSelection, setSplitMoveSelection] =
    useState<ICoordinate | null>(null);
  const [isViewingAsSpectator, setIsViewingAsSpectator] = useState(false);
  const [spectatorSource, setSpectatorSource] = useState<
    "eliminated" | "game-end" | null
  >(null);
  const renderGridWidth = renderGrid?.width ?? 0;
  const renderGridHeight = renderGrid?.height ?? 0;

  const handleSelectCell = useCallback((coord: ICoordinate) => {
    setSelection(coord);
    setSplitMoveSelection(null);
  }, []);

  const handleArmSplitMove = useCallback(
    (coord?: ICoordinate) => {
      const nextSelection = coord ?? selection;
      if (!nextSelection) return;
      setSelection(nextSelection);
      setSplitMoveSelection(nextSelection);
    },
    [selection],
  );

  const handleQueueMove = useCallback(
    (direction: MoveDirection) => {
      if (!selection || !room || !renderGrid) return;
      const from = selection;
      const to = getTargetCoord({ from, direction });
      if (!isCoordInBounds(to, renderGridWidth, renderGridHeight)) {
        return;
      }
      const moveType = isSameCoord(splitMoveSelection, from)
        ? ActionType.SPLIT_MOVE
        : ActionType.MOVE;

      setSelection(to);
      setSplitMoveSelection(null);
      sendMove(from, to, moveType);
    },
    [
      renderGrid,
      renderGridHeight,
      renderGridWidth,
      selection,
      room,
      sendMove,
      splitMoveSelection,
    ],
  );

  const handleReturn = () => {
    clearPersistedGameSession();
    source.onReturn();
  };

  /**
   * Leave the failed match recovery path and send users to a usable lobby.
   *
   * Custom games live under `/match/:roomId`, so a failed custom recovery needs
   * an explicit navigation away from the stale setup URL after clearing state.
   */
  const handleConnectionFailedReturn = () => {
    clearPersistedGameSession();
    source.onReturn();
    if (source.type === "custom") {
      navigate("/");
    }
  };

  useEffect(() => {
    if (gameResult && spectatorSource === "eliminated") {
      setIsViewingAsSpectator(false);
      setSpectatorSource(null);
    }
  }, [gameResult, spectatorSource]);

  useEffect(() => {
    hasHandledRecoveryFailureRef.current = false;
  }, []);

  useEffect(() => {
    if (
      !error ||
      connection.type !== "recovery" ||
      source.type !== "custom" ||
      !onRecoveryFailed ||
      hasHandledRecoveryFailureRef.current
    ) {
      return;
    }

    hasHandledRecoveryFailureRef.current = true;
    onRecoveryFailed();
  }, [connection.type, error, onRecoveryFailed, source.type]);

  if (
    error &&
    connection.type === "recovery" &&
    source.type === "custom" &&
    onRecoveryFailed
  ) {
    return (
      <StageCenter>
        <LoadingPanel message="Rejoining custom room" />
      </StageCenter>
    );
  }

  if (error) {
    return (
      <StageCenter>
        <ErrorPanel
          message={error}
          action={
            <Button type="button" onClick={handleConnectionFailedReturn}>
              Return to lobby
            </Button>
          }
        />
      </StageCenter>
    );
  }

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
  const isPlayerEliminated =
    currentPlayer?.status === PlayerStatus.ELIMINATED && !gameResult;
  const isReadOnly =
    isViewingAsSpectator || Boolean(gameResult) || isPlayerEliminated;
  const winnerId = gameResult?.winnerTeamId
    ? Array.from(gameState.publicPlayers.values()).find(
        (p) => p.teamId === gameResult.winnerTeamId,
      )?.id
    : null;
  const winnerName = winnerId ? playerNames.get(winnerId) : null;
  const didWin = Boolean(
    gameResult?.winnerTeamId &&
      currentPlayer?.teamId === gameResult.winnerTeamId,
  );
  const activeModal = gameResult
    ? isViewingAsSpectator && spectatorSource === "game-end"
      ? null
      : "game-end"
    : !isViewingAsSpectator && isPlayerEliminated
      ? "eliminated"
      : null;
  const returnLabel =
    source.type === "official" ? "Return to lobby" : "Return to setup room";

  return (
    <div className="fixed inset-0 z-20 bg-game-bg">
      {isViewingAsSpectator ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-30 p-3">
          <div className="pointer-events-auto">
            <Button type="button" variant="outline" onClick={handleReturn}>
              Return
            </Button>
          </div>
        </div>
      ) : null}

      <GameApp
        grid={renderGrid}
        selection={isReadOnly ? null : selection}
        splitMoveSelection={isReadOnly ? null : splitMoveSelection}
        moveQueue={moveQueue}
        onSelectCell={isReadOnly ? () => {} : handleSelectCell}
        onArmSplitMove={isReadOnly ? () => {} : handleArmSplitMove}
        onQueueMove={isReadOnly ? () => {} : handleQueueMove}
        onClearMoveQueue={isReadOnly ? () => {} : clearMoveQueue}
        playerColors={playerColors}
      />

      <GameHud
        scoreboard={gameState.scoreboard}
        timer={{
          currentTick: gameState.tick,
          targetTick: 0,
          tickInterval: 0,
        }}
      />

      {activeModal ? (
        <Dialog open={true}>
          <DialogContent
            className="max-w-sm"
            aria-describedby={undefined}
            showCloseButton={false}
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {activeModal === "eliminated"
                  ? "You have been eliminated"
                  : didWin
                    ? "You won"
                    : winnerId
                      ? "You lost"
                      : "Game over"}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 space-y-1 text-sm text-game-text-dim">
              {activeModal === "eliminated" ? null : (
                <>
                  {!didWin && winnerName ? <p>Winner: {winnerName}</p> : null}
                  {!gameResult?.winnerTeamId ? (
                    <p>No winner was reported.</p>
                  ) : null}
                </>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsViewingAsSpectator(true);
                  setSpectatorSource(
                    activeModal === "eliminated" ? "eliminated" : "game-end",
                  );
                  setSelection(null);
                  setSplitMoveSelection(null);
                }}
              >
                View as spectator
              </Button>
              <Button type="button" onClick={handleReturn}>
                {returnLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
