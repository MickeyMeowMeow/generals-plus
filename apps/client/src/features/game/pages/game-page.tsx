import type { ICoordinate } from "@generals-plus/engine";
import {
  ActionType,
  GameMode,
  PlayerStatus,
  Terrain,
} from "@generals-plus/engine";
import type {
  DemolitionScoreboard,
  PayloadScoreboard,
} from "@generals-plus/shared-types";
import {
  MatchClientMessage,
  MatchServerMessage,
} from "@generals-plus/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorPanel, LoadingPanel, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import type { GameRoomConnection } from "#/features/game/api/use-game-room";
import { useGameRoom } from "#/features/game/api/use-game-room";
import { DisconnectDialog } from "#/features/game/components/disconnect-dialog";
import { GameHud } from "#/features/game/components/game-hud";
import { HotkeyOverlay } from "#/features/game/components/hotkey-overlay";
import { PingPanel } from "#/features/game/components/ping-panel";
import { ReturnButton } from "#/features/game/components/return-button";
import { StatusDialog } from "#/features/game/components/status-dialog";
import { SurrenderOverlay } from "#/features/game/components/surrender-overlay";
import { TurnCounter } from "#/features/game/components/turn-counter";
import {
  ChoosePingBrushModifier,
  ClearPingBrushKey,
  KeyToPing,
} from "#/features/game/config/hotkeys";
import { GameApp } from "#/features/game/renderer/game-app";
import type { Ping } from "#/features/game/renderer/layers/ping";
import type { MoveDirection } from "#/features/game/utils/move";
import { getTargetCoord } from "#/features/game/utils/move";
import { formatTeamLabel } from "#/features/game/utils/team-label";
import { parseTimerProps } from "#/features/game/utils/time-props";

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
      /** Returns from a finished custom match to its setup route. */
      onReturn: () => void;
    };

interface GamePageProps {
  /** Seat reservation used to enter the match room. */
  connection: GameRoomConnection;
  /** Return behavior and metadata for the flow that launched the match. */
  source: GamePageSource;
}

interface PublicPlayerLike {
  id: string;
  teamId: string;
  displayName?: string;
}

function getTeamMembers(
  players: Iterable<PublicPlayerLike>,
  teamId: string,
  playerNames: Map<string, string>,
) {
  return Array.from(players)
    .filter((player) => player.teamId === teamId)
    .map(
      (player) => playerNames.get(player.id) ?? player.displayName ?? player.id,
    );
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
export function GamePage({ connection, source }: GamePageProps) {
  /**
   * Keep the full connection payload stable across parent re-renders.
   *
   * Queue/setup parents create fresh object literals while rendering. We key
   * them by primitive identity fields but keep the original reservation object
   * intact, because Colyseus may attach SDK-specific fields beyond the visible
   * `{ name, roomId, sessionId }` tuple.
   */
  const connectionKey = `reservation:${connection.reservation.name}:${connection.reservation.roomId}:${connection.reservation.sessionId}`;
  const stableConnectionRef = useRef<{
    key: string;
    value: GameRoomConnection;
  } | null>(null);
  if (stableConnectionRef.current?.key !== connectionKey) {
    stableConnectionRef.current = { key: connectionKey, value: connection };
  }
  const stableConnection = stableConnectionRef.current.value;
  const {
    room,
    playerColors,
    playerNames,
    currentPlayer,
    renderTick,
    renderGrid,
    moveQueue,
    bombMoveSignal,
    gameState,
    gameResult,
    sendMove,
    clearMoveQueue,
    surrender,
    error,
    disconnectMessage,
    isConnecting,
  } = useGameRoom(stableConnection);

  const [pings, setPings] = useState<Ping[]>([]);
  const [activeBrush, setActiveBrush] = useState<
    "attack" | "defense" | "rally" | null
  >(null);

  useEffect(() => {
    if (!room) return;

    const unsubscribe = room.onMessage(MatchServerMessage.PING, (message) => {
      const pingId = `${message.x},${message.y}-${message.type}-${Date.now()}-${Math.random()}`;
      setPings((prev) => [
        ...prev,
        {
          id: pingId,
          x: message.x,
          y: message.y,
          type: message.type,
        },
      ]);

      // Remove after 5 seconds
      setTimeout(() => {
        setPings((prev) => prev.filter((p) => p.id !== pingId));
      }, 5000);
    });

    return () => {
      unsubscribe();
    };
  }, [room]);

  const [selection, setSelection] = useState<ICoordinate | null>(null);
  const [isStickySplitMove, setIsStickySplitMove] = useState(false);
  const [isActiveSplitMove, setIsActiveSplitMove] = useState(false);
  const isSplitMove = isStickySplitMove || isActiveSplitMove;

  const [isViewingAsSpectator, setIsViewingAsSpectator] = useState(false);
  const [spectatorSource, setSpectatorSource] = useState<
    "eliminated" | "game-end" | null
  >(null);

  const initialCoord = useRef<ICoordinate>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current || !renderGrid || !currentPlayer) return;

    // Find the player's general or any owned spawn cell to start selection
    let startCoord: ICoordinate | null = null;

    // Try to find a general
    for (const cell of renderGrid) {
      if (
        cell.terrain === Terrain.GENERAL &&
        cell.ownerIndex === currentPlayer.id
      ) {
        startCoord = cell.coordinate;
        break;
      }
    }

    // Fallback to any owned cell if no general is found
    if (!startCoord) {
      for (const cell of renderGrid) {
        if (cell.ownerIndex === currentPlayer.id) {
          startCoord = cell.coordinate;
          break;
        }
      }
    }

    if (startCoord) {
      initialCoord.current = startCoord;
      setSelection(startCoord);
      hasInitializedRef.current = true;
    }
  }, [renderGrid, currentPlayer]);

  const handlePing = useCallback(
    (coord: ICoordinate, type: "attack" | "defense" | "rally") => {
      room?.send(MatchClientMessage.PING, {
        type,
        ...coord,
      });
    },
    [room],
  );

  const handleSelectCell = useCallback(
    (coord: ICoordinate) => {
      if (activeBrush) {
        handlePing(coord, activeBrush);
        return;
      }
      const cell = renderGrid?.get(coord);
      if (!cell || cell.terrain === Terrain.VOID) return;

      setSelection(coord);
      setIsStickySplitMove(false);
    },
    [activeBrush, handlePing, renderGrid],
  );

  const handleToggleStickySplitMove = useCallback(() => {
    if (!isActiveSplitMove) {
      setIsStickySplitMove((prev) => !prev);
    }
  }, [isActiveSplitMove]);

  const handleQueueMove = useCallback(
    (direction: MoveDirection) => {
      if (!selection || !room || !renderGrid) return;
      const from = selection;
      const to = getTargetCoord({ from, direction });
      if (!renderGrid.isValid(to)) {
        return;
      }

      const targetCell = renderGrid.get(to);
      if (
        !targetCell ||
        targetCell.terrain === Terrain.MOUNTAIN ||
        targetCell.terrain === Terrain.VOID
      ) {
        return;
      }

      const moveType = isSplitMove ? ActionType.SPLIT_MOVE : ActionType.MOVE;
      setSelection(to);
      setIsStickySplitMove(false);
      sendMove(from, to, moveType);
    },
    [renderGrid, selection, room, sendMove, isSplitMove],
  );

  const handleReturn = () => {
    source.onReturn();
  };

  const isPlayerEliminated =
    currentPlayer?.status === PlayerStatus.ELIMINATED && !gameResult;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in a text field
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.hasAttribute("contenteditable")
      ) {
        return;
      }

      if (e.code === ClearPingBrushKey) {
        setActiveBrush(null);
      }

      if (e.getModifierState(ChoosePingBrushModifier) && KeyToPing[e.code]) {
        const pingType = KeyToPing[e.code];
        setActiveBrush((prev) => (prev === pingType ? null : pingType));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (gameResult && spectatorSource === "eliminated") {
      setIsViewingAsSpectator(false);
      setSpectatorSource(null);
    }
  }, [gameResult, spectatorSource]);

  if (error) {
    return (
      <StageCenter>
        <ErrorPanel
          message={error}
          action={
            <Button type="button" onClick={handleReturn}>
              {source.type === "official"
                ? "Return to lobby"
                : "Return to setup room"}
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

  if (!renderGrid) {
    return (
      <StageCenter>
        <LoadingPanel message="Loading battlefield" />
      </StageCenter>
    );
  }

  const isReadOnly =
    isViewingAsSpectator ||
    Boolean(gameResult) ||
    isPlayerEliminated ||
    Boolean(disconnectMessage);

  const winnerTeamId = gameResult?.winnerTeamId ?? null;
  const winnerTeamMembers = winnerTeamId
    ? getTeamMembers(
        gameState.publicPlayers.values(),
        winnerTeamId,
        playerNames,
      )
    : [];
  const winnerTeamLabel = winnerTeamId ? formatTeamLabel(winnerTeamId) : null;
  const didWin = Boolean(
    winnerTeamId && currentPlayer?.teamId === winnerTeamId,
  );

  const statusMode = disconnectMessage
    ? null
    : gameResult
      ? isViewingAsSpectator && spectatorSource === "game-end"
        ? null
        : "game-end"
      : !isViewingAsSpectator && isPlayerEliminated
        ? "eliminated"
        : null;

  const canSurrender =
    !isConnecting &&
    Boolean(room) &&
    Boolean(gameState) &&
    Boolean(renderGrid) &&
    !disconnectMessage &&
    !gameResult &&
    !isViewingAsSpectator &&
    !isPlayerEliminated &&
    currentPlayer?.status === PlayerStatus.ACTIVE &&
    !isReadOnly &&
    !statusMode;

  const returnLabel =
    source.type === "official" ? "Return to lobby" : "Return to setup room";

  return (
    <div className="fixed inset-0 z-20 bg-game-bg">
      <div className="pointer-events-none fixed left-0 top-0 z-30 flex flex-col items-start gap-2 p-3">
        <TurnCounter tick={gameState.tick} />
        {isViewingAsSpectator ? <ReturnButton onReturn={handleReturn} /> : null}
      </div>

      <GameApp
        tick={renderTick}
        grid={renderGrid}
        initialCoord={initialCoord.current ?? undefined}
        selection={isReadOnly ? null : selection}
        isSplitMove={isSplitMove}
        moveQueue={moveQueue}
        bombMoveSignal={bombMoveSignal}
        onSelectCell={isReadOnly ? () => {} : handleSelectCell}
        onToggleStickySplitMove={
          isReadOnly ? () => {} : handleToggleStickySplitMove
        }
        onUpdateActiveSplitMove={isReadOnly ? () => {} : setIsActiveSplitMove}
        onQueueMove={isReadOnly ? () => {} : handleQueueMove}
        onClearMoveQueue={isReadOnly ? () => {} : clearMoveQueue}
        onPing={isReadOnly ? () => {} : handlePing}
        playerColors={playerColors}
        pings={pings}
        isPlanted={
          gameState.mode === GameMode.DEMOLITION
            ? !!(gameState.scoreboard as DemolitionScoreboard).isPlanted
            : false
        }
        ticksRemaining={
          gameState.mode === GameMode.DEMOLITION
            ? Math.max(
                0,
                (gameState.scoreboard as DemolitionScoreboard).detonationTick -
                  gameState.tick,
              )
            : -1
        }
        payloadTrackX={
          gameState.payloadTrackX ? Array.from(gameState.payloadTrackX) : []
        }
        payloadTrackY={
          gameState.payloadTrackY ? Array.from(gameState.payloadTrackY) : []
        }
        cartIndex={
          gameState.mode === GameMode.PAYLOAD
            ? ((gameState.scoreboard as PayloadScoreboard).cartIndex ?? -1)
            : -1
        }
        cartSize={
          gameState.mode === GameMode.PAYLOAD
            ? ((gameState.scoreboard as PayloadScoreboard).cartSize ?? 0)
            : 0
        }
      />

      <GameHud
        scoreboard={gameState.scoreboard}
        targetScore={gameState.targetScore}
        timer={parseTimerProps(gameState)}
      />

      <HotkeyOverlay gridType={renderGrid.gridType} />

      <PingPanel activeBrush={activeBrush} setActiveBrush={setActiveBrush} />

      <DisconnectDialog
        message={disconnectMessage}
        returnLabel={returnLabel}
        onReturn={handleReturn}
      />

      <SurrenderOverlay
        canSurrender={canSurrender}
        onSurrender={() => {
          setActiveBrush(null);
          setSelection(null);
          setIsStickySplitMove(false);
          surrender();
        }}
      />

      <StatusDialog
        mode={statusMode}
        didWin={didWin}
        winnerTeamLabel={winnerTeamLabel}
        winnerTeamMembers={winnerTeamMembers}
        returnLabel={returnLabel}
        onSpectate={() => {
          setIsViewingAsSpectator(true);
          setSpectatorSource(
            statusMode === "eliminated" ? "eliminated" : "game-end",
          );
          setSelection(null);
          setIsStickySplitMove(false);
        }}
        onReturn={handleReturn}
      />
    </div>
  );
}
