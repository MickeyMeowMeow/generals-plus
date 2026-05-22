import type { ICoordinate } from "@generals-plus/engine";
import {
  ActionType,
  GameMode,
  PlayerStatus,
  Terrain,
} from "@generals-plus/engine";
import {
  MatchClientMessage,
  MatchServerMessage,
} from "@generals-plus/shared-types";
import { Flag, Shield, Swords, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorPanel, LoadingPanel, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import type { GameRoomConnection } from "#/features/game/api/use-game-room";
import { useGameRoom } from "#/features/game/api/use-game-room";
import { GameHud } from "#/features/game/components/game-hud";
import { GameApp } from "#/features/game/renderer/game-app";
import type { Ping } from "#/features/game/renderer/layers/ping";
import { isCoordInBounds, isSameCoord } from "#/features/game/utils/coord";
import type { MoveDirection } from "#/features/game/utils/move";
import { getTargetCoord } from "#/features/game/utils/move";
import { formatTeamLabel } from "#/features/match/utils/team-label";
import { cn } from "#/lib/utils";

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
    renderGrid,
    moveQueue,
    gameState,
    gameResult,
    sendMove,
    clearMoveQueue,
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

      if (e.key === "Escape") {
        setActiveBrush(null);
      } else if (e.key === "1") {
        setActiveBrush((prev) => (prev === "attack" ? null : "attack"));
      } else if (e.key === "2") {
        setActiveBrush((prev) => (prev === "defense" ? null : "defense"));
      } else if (e.key === "3") {
        setActiveBrush((prev) => (prev === "rally" ? null : "rally"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [selection, setSelection] = useState<ICoordinate | null>(null);
  const [splitMoveSelection, setSplitMoveSelection] =
    useState<ICoordinate | null>(null);
  const [isViewingAsSpectator, setIsViewingAsSpectator] = useState(false);
  const [spectatorSource, setSpectatorSource] = useState<
    "eliminated" | "game-end" | null
  >(null);
  const renderGridWidth = renderGrid?.width ?? 0;
  const renderGridHeight = renderGrid?.height ?? 0;

  const initialCoord = useRef<ICoordinate>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current || !renderGrid || !currentPlayer) return;

    // Find the player's general or any owned spawn cell to start selection
    let startCoord: ICoordinate | null = null;

    // 1. Try to find a General
    for (const cell of renderGrid) {
      if (
        cell.terrain === Terrain.GENERAL &&
        cell.ownerIndex === currentPlayer.id
      ) {
        startCoord = cell.coordinate;
        break;
      }
    }

    // 2. Fallback to any owned spawn cell (like the starting city in Domination)
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

  const handleSelectCell = useCallback(
    (coord: ICoordinate) => {
      if (activeBrush) {
        room?.send(MatchClientMessage.PING, {
          x: coord.x,
          y: coord.y,
          type: activeBrush,
        });
        return;
      }
      setSelection(coord);
      setSplitMoveSelection(null);
    },
    [activeBrush, room],
  );

  const handleArmSplitMove = useCallback(
    (coord?: ICoordinate) => {
      if (activeBrush) {
        if (coord) {
          room?.send(MatchClientMessage.PING, {
            x: coord.x,
            y: coord.y,
            type: activeBrush,
          });
        }
        return;
      }
      const nextSelection = coord ?? selection;
      if (!nextSelection) return;
      setSelection(nextSelection);
      setSplitMoveSelection(nextSelection);
    },
    [activeBrush, selection, room],
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
    source.onReturn();
  };

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

  if (!renderGrid)
    return (
      <StageCenter>
        <LoadingPanel message="Loading battlefield" />
      </StageCenter>
    );

  const isPlayerEliminated =
    currentPlayer?.status === PlayerStatus.ELIMINATED && !gameResult;
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
  const isTeamResult = winnerTeamMembers.length > 1;
  const winnerName = winnerTeamMembers[0] ?? null;
  const winnerTeamLabel = winnerTeamId ? formatTeamLabel(winnerTeamId) : null;
  const didWin = Boolean(
    winnerTeamId && currentPlayer?.teamId === winnerTeamId,
  );
  const activeModal = disconnectMessage
    ? null
    : gameResult
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
          <div className="pointer-events-auto inline-flex rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.76)] p-1 shadow-xl shadow-black/25 backdrop-blur-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleReturn}
              aria-label="Return"
              title="Return"
              className="size-8 text-game-text hover:bg-white/8 hover:text-game-text"
            >
              <Undo2 className="mt-px size-5" />
            </Button>
          </div>
        </div>
      ) : null}

      <GameApp
        grid={renderGrid}
        initialCoord={initialCoord.current ?? undefined}
        selection={isReadOnly ? null : selection}
        splitMoveSelection={isReadOnly ? null : splitMoveSelection}
        moveQueue={moveQueue}
        onSelectCell={isReadOnly ? () => {} : handleSelectCell}
        onArmSplitMove={isReadOnly ? () => {} : handleArmSplitMove}
        onQueueMove={isReadOnly ? () => {} : handleQueueMove}
        onClearMoveQueue={isReadOnly ? () => {} : clearMoveQueue}
        playerColors={playerColors}
        pings={pings}
      />

      <GameHud
        scoreboard={gameState.scoreboard}
        targetScore={gameState.targetScore}
        timer={{
          currentTick: gameState.tick,
          targetTick:
            gameState.mode === GameMode.TURF_WAR ||
            gameState.mode === GameMode.DOMINATION
              ? gameState.finishTick > 0
                ? gameState.finishTick
                : 0
              : 0,
          tickInterval:
            gameState.mode === GameMode.TURF_WAR ||
            gameState.mode === GameMode.DOMINATION
              ? gameState.tickInterval
              : 0,
        }}
      />

      {/* Floating Brush Tool Panel */}
      <div className="fixed bottom-4 right-4 z-30 flex flex-col gap-2 rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.76)] p-2 shadow-xl shadow-black/25 backdrop-blur-sm">
        <Button
          type="button"
          variant={activeBrush === "attack" ? "default" : "outline"}
          size="icon"
          onClick={() =>
            setActiveBrush(activeBrush === "attack" ? null : "attack")
          }
          className={cn(
            "size-9 transition-all hover:scale-105 rounded-none",
            activeBrush === "attack"
              ? "ring-2 ring-red-400/50 bg-red-950/20 border-red-400"
              : "border-game-border",
          )}
          title="Mark Attack (Swords) [1]"
        >
          <Swords
            className={cn(
              "size-4 text-red-400",
              activeBrush === "attack" && "animate-pulse",
            )}
          />
        </Button>

        <Button
          type="button"
          variant={activeBrush === "defense" ? "default" : "outline"}
          size="icon"
          onClick={() =>
            setActiveBrush(activeBrush === "defense" ? null : "defense")
          }
          className={cn(
            "size-9 transition-all hover:scale-105 rounded-none",
            activeBrush === "defense"
              ? "ring-2 ring-blue-400/50 bg-blue-950/20 border-blue-400"
              : "border-game-border",
          )}
          title="Mark Defense (Shield) [2]"
        >
          <Shield
            className={cn(
              "size-4 text-blue-400",
              activeBrush === "defense" && "animate-pulse",
            )}
          />
        </Button>

        <Button
          type="button"
          variant={activeBrush === "rally" ? "default" : "outline"}
          size="icon"
          onClick={() =>
            setActiveBrush(activeBrush === "rally" ? null : "rally")
          }
          className={cn(
            "size-9 transition-all hover:scale-105 rounded-none",
            activeBrush === "rally"
              ? "ring-2 ring-green-400/50 bg-green-950/20 border-green-400"
              : "border-game-border",
          )}
          title="Mark Rally (Flag) [3]"
        >
          <Flag
            className={cn(
              "size-4 text-green-400",
              activeBrush === "rally" && "animate-pulse",
            )}
          />
        </Button>
      </div>

      {disconnectMessage ? (
        <Dialog open={true}>
          <DialogContent
            className="max-w-sm"
            aria-describedby={undefined}
            showCloseButton={false}
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl">Disconnected</DialogTitle>
              <DialogDescription>{disconnectMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={handleReturn}>
                {returnLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

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
                  : didWin && isTeamResult
                    ? "Your team won"
                    : didWin
                      ? "You won"
                      : winnerTeamId && isTeamResult
                        ? "Your team lost"
                        : winnerTeamId
                          ? "You lost"
                          : "Game over"}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 space-y-1 text-sm text-game-text-dim">
              {activeModal === "eliminated" ? null : (
                <>
                  {!didWin && isTeamResult && winnerTeamLabel ? (
                    <p>
                      Winners: {winnerTeamLabel},{" "}
                      {winnerTeamMembers.join(" & ")}
                    </p>
                  ) : null}
                  {!didWin && !isTeamResult && winnerName ? (
                    <p>Winner: {winnerName}</p>
                  ) : null}
                  {!winnerTeamId ? <p>No winner was reported.</p> : null}
                </>
              )}
            </div>
            <DialogFooter>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
