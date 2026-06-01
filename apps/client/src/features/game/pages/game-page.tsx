import type { ICoordinate } from "@generals-plus/engine";
import {
  ActionType,
  GameMode,
  GridType,
  PlayerStatus,
  Terrain,
} from "@generals-plus/engine";
import type {
  CollapseScoreboard,
  DemolitionScoreboard,
  PayloadScoreboard,
  RugbyScoreboard,
} from "@generals-plus/shared-types";
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
import {
  ChoosePingBrushModifier,
  ClearPingBrushKey,
  KeyToPing,
  SurrenderKey,
} from "#/features/game/utils/hotkey";
import type { MoveDirection } from "#/features/game/utils/move";
import { getTargetCoord } from "#/features/game/utils/move";
import { formatTeamLabel } from "#/features/match/utils/team-label";
import { AnimatedNumber } from "#/features/motion/components/animated-number";
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
  const [isSurrenderDialogOpen, setIsSurrenderDialogOpen] = useState(false);
  const [isHotkeysOpen, setIsHotkeysOpen] = useState(false);

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
  const canOpenSurrenderDialog =
    !isConnecting &&
    Boolean(room) &&
    Boolean(gameState) &&
    Boolean(renderGrid) &&
    !disconnectMessage &&
    !gameResult &&
    !isViewingAsSpectator &&
    !isPlayerEliminated &&
    currentPlayer?.status === PlayerStatus.ACTIVE;

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

      if (e.key === "?") {
        setIsHotkeysOpen((prev) => !prev);
        return;
      }

      if (e.code === SurrenderKey) {
        if (isSurrenderDialogOpen || !canOpenSurrenderDialog) {
          return;
        }
        e.preventDefault();
        setIsSurrenderDialogOpen(true);
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
  }, [canOpenSurrenderDialog, isSurrenderDialogOpen]);

  useEffect(() => {
    if (gameResult && spectatorSource === "eliminated") {
      setIsViewingAsSpectator(false);
      setSpectatorSource(null);
    }
  }, [gameResult, spectatorSource]);

  useEffect(() => {
    if (isSurrenderDialogOpen && !canOpenSurrenderDialog) {
      setIsSurrenderDialogOpen(false);
    }
  }, [canOpenSurrenderDialog, isSurrenderDialogOpen]);

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
  const canSurrender = canOpenSurrenderDialog && !isReadOnly && !activeModal;
  const returnLabel =
    source.type === "official" ? "Return to lobby" : "Return to setup room";

  return (
    <div className="fixed inset-0 z-20 bg-game-bg">
      <div className="pointer-events-none fixed left-0 top-0 z-30 flex flex-col items-start gap-2 p-3">
        <div className="inline-flex items-center rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.76)] px-3 py-1.5 shadow-xl shadow-black/25 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-game-text-dim/80">
            Turn
          </span>
          <span className="ml-2 text-[15px] font-semibold tabular-nums text-game-text">
            <AnimatedNumber value={gameState.tick} />
          </span>
        </div>

        {isViewingAsSpectator ? (
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
        ) : null}
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

      {(() => {
        let timerProps: {
          currentTick: number;
          targetTick: number;
          tickInterval: number;
          label?: string;
          startTick?: number;
        } = {
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
          label: "Time remaining",
        };

        if (gameState.mode === GameMode.DEMOLITION) {
          const demoScoreboard = gameState.scoreboard as DemolitionScoreboard;

          if (demoScoreboard.plantProgressTicks > 0) {
            timerProps = {
              currentTick: demoScoreboard.plantProgressTicks,
              targetTick: demoScoreboard.plantDurationTicks,
              tickInterval: gameState.tickInterval,
              label: "Planting C4...",
            };
          } else if (demoScoreboard.defuseProgressTicks > 0) {
            timerProps = {
              currentTick: demoScoreboard.defuseProgressTicks,
              targetTick: demoScoreboard.defuseDurationTicks,
              tickInterval: gameState.tickInterval,
              label: "Defusing C4...",
            };
          } else if (demoScoreboard.plantedAtSite) {
            const remainingTicks = Math.max(
              0,
              demoScoreboard.detonationTick - gameState.tick,
            );
            const elapsedTicks = Math.max(
              0,
              demoScoreboard.detonateDurationTicks - remainingTicks,
            );

            timerProps = {
              currentTick: elapsedTicks,
              targetTick: demoScoreboard.detonateDurationTicks,
              tickInterval: gameState.tickInterval,
              label: `Bomb Planted (Site ${demoScoreboard.plantedAtSite})`,
            };
          } else {
            timerProps = {
              currentTick: gameState.tick,
              targetTick: gameState.finishTick > 0 ? gameState.finishTick : 0,
              tickInterval: gameState.tickInterval,
              label: "Time remaining",
            };
          }
        }

        if (gameState.mode === GameMode.COLLAPSE) {
          const collapseScoreboard = gameState.scoreboard as CollapseScoreboard;
          const startDelay = collapseScoreboard.startDelayTicks ?? 120;
          const shrinkInterval = collapseScoreboard.shrinkIntervalTicks ?? 60;
          const startTick =
            gameState.tick < startDelay
              ? 0
              : collapseScoreboard.nextCollapseTick - shrinkInterval;

          timerProps = {
            currentTick: gameState.tick,
            targetTick: collapseScoreboard.nextCollapseTick,
            tickInterval: gameState.tickInterval,
            label: "Void Collapse",
            startTick,
          };
        }

        if (gameState.mode === GameMode.PAYLOAD) {
          timerProps = {
            currentTick: gameState.tick,
            targetTick: gameState.finishTick > 0 ? gameState.finishTick : 0,
            tickInterval: gameState.tickInterval,
            label: "Time remaining",
          };
        }

        if (gameState.mode === GameMode.RUGBY) {
          const rugbyScoreboard = gameState.scoreboard as RugbyScoreboard;
          const totalTicks =
            rugbyScoreboard.totalTime > 0
              ? Math.round(
                  (rugbyScoreboard.totalTime * 1000) /
                    (gameState.tickInterval || 500),
                )
              : 0;

          timerProps = {
            currentTick: gameState.tick,
            targetTick:
              gameState.finishTick > 0 ? gameState.finishTick : totalTicks,
            tickInterval: gameState.tickInterval,
            label: "Time remaining",
          };
        }

        return (
          <GameHud
            scoreboard={gameState.scoreboard}
            targetScore={gameState.targetScore}
            timer={timerProps}
          />
        );
      })()}

      {/* Hotkey Panel */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-30 flex flex-col gap-1.5 rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.76)] p-3 text-xs text-game-text-dim shadow-xl shadow-black/25 backdrop-blur-sm">
        {isHotkeysOpen ? (
          <>
            <h3 className="mb-1 font-semibold text-game-text">Hotkeys</h3>
            <p>
              <span className="font-mono text-game-text">
                {renderGrid.gridType === GridType.HEX ? "QWEASD" : "WASD"}
              </span>{" "}
              to move
            </p>
            <p>
              <span className="font-mono text-game-text">Shift</span> + move to
              split move
            </p>
            <p>
              <span className="font-mono text-game-text">Double click</span> or{" "}
              <span className="font-mono text-game-text">right click</span> to
              toggle split move
            </p>
            <p>
              <span className="font-mono text-game-text">Space</span> to clear
              move queue
            </p>
            <p>
              <span className="font-mono text-game-text">1/2/3</span> to ping
              attack / defense / rally
            </p>
            <p>
              <span className="font-mono text-game-text">Shift + 1/2/3</span> to
              change ping brush (click to ping)
            </p>
            <p>
              <span className="font-mono text-game-text">Escape</span> to
              surrender
            </p>
          </>
        ) : (
          <p>
            Press <span className="font-mono text-game-text">?</span> for
            hotkeys
          </p>
        )}
      </div>

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

      {canSurrender ? (
        <Dialog
          open={isSurrenderDialogOpen}
          onOpenChange={setIsSurrenderDialogOpen}
        >
          <DialogContent
            className="max-w-sm"
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl">Surrender match?</DialogTitle>
              <DialogDescription>
                This will immediately eliminate you from the current match.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSurrenderDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setIsSurrenderDialogOpen(false);
                  setActiveBrush(null);
                  setSelection(null);
                  setIsStickySplitMove(false);
                  surrender();
                }}
              >
                Surrender
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
                  {didWin && isTeamResult && winnerTeamLabel ? (
                    <p>Team members: {winnerTeamMembers.join(" & ")}</p>
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
                  setIsStickySplitMove(false);
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
