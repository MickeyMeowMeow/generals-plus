import type { ISeatReservation } from "@colyseus/sdk/Client";
import type { ICoordinate, IGameResult } from "@generals-plus/engine";
import { ActionType } from "@generals-plus/engine";
import type {
  ActionData,
  MatchClientMessagePayload,
  MatchServerMessagePayload,
  MatchState,
} from "@generals-plus/shared-types";
import {
  MatchClientMessage,
  MatchServerMessage,
} from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { createRenderGrid } from "#/features/game/utils/grid-adapter";
import type { MoveIntent } from "#/features/game/utils/move";
import { MoveDirection } from "#/features/game/utils/move";
import { networkProvider } from "#/infra/network/provider";
import type { RoomClient } from "#/infra/network/room";

type GameRoomClient = RoomClient<
  MatchState,
  MatchClientMessagePayload,
  MatchServerMessagePayload
>;

/**
 * Describes how the client should enter a match room.
 *
 * The normal queue/setup flow uses a one-shot seat reservation. A refreshed page
 * no longer has that reservation in React state, so it uses the Colyseus
 * recovery token persisted from the previous live match connection.
 */
export type GameRoomConnection =
  | {
      /** Consume a server-issued seat reservation for the first match entry. */
      type: "reservation";
      reservation: ISeatReservation;
    }
  | {
      /** Restore an already-consumed match session after refresh or crash. */
      type: "recovery";
      recoveryToken: string;
    };

/**
 * Minimal route context needed to bring a recovered match back to the right UI.
 *
 * Official games recover on `/`; custom games recover only when the current
 * `/match/:roomId` URL matches the setup room that originally launched them.
 */
export type PersistedGameSource =
  | {
      type: "official";
    }
  | {
      type: "custom";
      setupRoomId: string;
    };

/**
 * LocalStorage payload that survives page refresh while a match is in progress.
 */
export interface PersistedGameSession {
  /** Colyseus token used by `restoreSession()` for the match room. */
  recoveryToken: string;
  /** Route context used to decide whether this page should attempt recovery. */
  source: PersistedGameSource;
}

const ACTIVE_GAME_SESSION_KEY = "generals_plus_active_game_session";
/** Upper bound for recovery attempts so stale tokens cannot trap the UI. */
const RECOVERY_TIMEOUT_MS = 10_000;

/**
 * Read the persisted match recovery session, ignoring malformed or unavailable
 * localStorage values so startup can always fall back to the normal lobby/setup.
 */
export function loadPersistedGameSession(): PersistedGameSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_GAME_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<PersistedGameSession>;
    if (
      typeof session.recoveryToken === "string" &&
      session.recoveryToken &&
      session.source?.type
    ) {
      return session as PersistedGameSession;
    }
  } catch {
    // Ignore malformed or unavailable localStorage.
  }
  return null;
}

/**
 * Remove the persisted match recovery session after a user leaves, signs out, or
 * a recovery attempt proves the token is stale.
 */
export function clearPersistedGameSession() {
  try {
    localStorage.removeItem(ACTIVE_GAME_SESSION_KEY);
  } catch {
    // Ignore unavailable localStorage.
  }
}

/**
 * Persist enough information to recover the current match after a full page
 * reload. Empty recovery tokens are ignored because they cannot restore a room.
 */
function persistGameSession(
  recoveryToken: string | null,
  source: PersistedGameSource,
) {
  if (!recoveryToken) return;
  try {
    localStorage.setItem(
      ACTIVE_GAME_SESSION_KEY,
      JSON.stringify({ recoveryToken, source }),
    );
  } catch {
    // Ignore unavailable localStorage.
  }
}

/**
 * Shared client-side handle for one consumed match-room seat reservation.
 *
 * Colyseus seat reservations are a one-time handoff from queue/setup into the
 * match room. React can briefly mount, unmount, and remount the game page around
 * that handoff, especially during route transitions or StrictMode. This handle
 * ensures the reservation is consumed once and every current consumer shares the
 * same resulting room connection.
 */
interface SharedGameConnection {
  /** Resolves to the game room created by consuming the seat reservation. */
  promise: Promise<GameRoomClient>;
  /** The resolved game room instance, available after `promise` completes. */
  room: GameRoomClient | null;
  /** Number of mounted `useGameRoom` consumers using this connection. */
  refs: number;
}

/**
 * In-memory cache of consumed game-room reservations.
 *
 * The cache is scoped to the current page session because seat reservations are
 * ephemeral. It prevents duplicate `consumeSeatReservation()` calls for the
 * same `{ name, roomId, sessionId }` tuple, which would otherwise surface as
 * "seat reservation expired" even though the first consume succeeded.
 */
const gameConnections = new Map<string, SharedGameConnection>();

/**
 * Clear the in-memory match connection pool between tests so one test's cached
 * room promise cannot affect another scenario.
 */
export function resetGameConnectionsForTesting() {
  gameConnections.clear();
}

/**
 * Build a stable cache key for one reserved match seat.
 *
 * `roomId` alone is not sufficient because different players consume different
 * seats in the same room. Including `sessionId` keeps each player's reservation
 * isolated while still deduplicating remounts for that exact player.
 */
function getReservationKey(reservation: ISeatReservation) {
  return `${reservation.name}:${reservation.roomId}:${reservation.sessionId}`;
}

/**
 * Build a cache key for both first-entry reservations and refresh recovery.
 */
function getConnectionKey(connection: GameRoomConnection) {
  return connection.type === "reservation"
    ? getReservationKey(connection.reservation)
    : `recovery:${connection.recoveryToken}`;
}

/**
 * Consume or reuse a match-room seat reservation.
 *
 * The first caller starts the Colyseus request and stores its promise. Later
 * callers with the same connection key reuse that promise/room, canceling any
 * pending React remounts can reuse the same live match socket.
 */
function acquireGameRoom(connection: GameRoomConnection) {
  const key = getConnectionKey(connection);
  let entry = gameConnections.get(key);

  if (entry) {
    entry.refs++;
    return entry.promise;
  }

  entry = {
    refs: 1,
    room: null,
    promise: (connection.type === "reservation"
      ? networkProvider.consumeSeatReservation<
          MatchState,
          MatchClientMessagePayload,
          MatchServerMessagePayload
        >(connection.reservation)
      : networkProvider.restoreSession<
          MatchState,
          MatchClientMessagePayload,
          MatchServerMessagePayload
        >(connection.recoveryToken)
    )
      .then((room) => {
        const current = gameConnections.get(key);
        if (current) current.room = room;
        return room;
      })
      .catch((error) => {
        if (gameConnections.get(key) === entry) {
          gameConnections.delete(key);
        }
        throw error;
      }),
  };
  gameConnections.set(key, entry);
  return entry.promise;
}

/**
 * Wrap a connection attempt with a UI-level timeout.
 *
 * Colyseus recovery can keep retrying internally when a room has already been
 * disposed. The page needs a bounded failure path so the user can return to the
 * lobby instead of staring at a permanent loading state.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Release one mounted game page's reference to a consumed match room.
 *
 * Unlike setup/queue rooms, match-room `leave()` is gameplay-significant:
 * `MatchRoom.onLeave` treats it as surrender. React cleanup can run for benign
 * reasons such as StrictMode probes, route handoffs, and refresh recovery, so it
 * must not actively leave or discard the match. The socket is closed by page
 * unload, server game end, or SDK/network lifecycle.
 */
function releaseGameRoom(connection: GameRoomConnection) {
  const key = getConnectionKey(connection);
  const entry = gameConnections.get(key);
  if (!entry) return;

  entry.refs = Math.max(0, entry.refs - 1);
}

/**
 * Convert a pair of adjacent grid coordinates into the renderer's move intent
 * direction. The server protocol stores moves as from/to coordinates; the Pixi
 * move-queue overlay renders them as directional arrows.
 */
function getDirection(from: ICoordinate, to: ICoordinate): MoveDirection {
  if (to.y < from.y) return MoveDirection.UP;
  if (to.y > from.y) return MoveDirection.DOWN;
  if (to.x < from.x) return MoveDirection.LEFT;
  return MoveDirection.RIGHT;
}

/**
 * Guard against rendering from a partially patched Colyseus schema.
 *
 * Immediately after join/recovery, `room.state` may exist before all nested maps
 * have been populated. Waiting for the required schema containers avoids null
 * access while still allowing us to use already-arrived state on refresh.
 */
function isReadyMatchState(state: MatchState) {
  return Boolean(
    state.publicPlayers &&
      state.clientVisions &&
      state.clientActionQueues &&
      state.players,
  );
}

/**
 * Connect the game page to a reserved Colyseus match room.
 *
 * The hook consumes a seat reservation or restores a persisted recovery token,
 * subscribes to authoritative match state, adapts the current client's vision
 * schema into a render grid, mirrors the player's server-side action queue for
 * the movement overlay, and exposes a typed `sendMove` command for user input.
 */
export function useGameRoom(
  connection: GameRoomConnection,
  source: PersistedGameSource,
) {
  const [room, setRoom] = useState<GameRoomClient | null>(null);
  const [renderGrid, setRenderGrid] = useState<RenderGrid | null>(null);
  const [moveQueue, setMoveQueue] = useState<MoveIntent[]>([]);
  const [gameState, setGameState] = useState<MatchState | null>(null);
  const [gameResult, setGameResult] = useState<IGameResult | null>(null);
  const [playerColors, setPlayerColors] = useState<Map<string, number>>(
    new Map(),
  );
  const [playerNames, setPlayerNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  useEffect(() => {
    if (!connection) return;

    let isCurrent = true;
    const unsubscribers: Array<() => void> = [];

    const connect = async () => {
      setIsConnecting(true);
      setError(null);
      setGameResult(null);
      setConnectionStatus("connecting");
      try {
        const currentRoom = await (connection.type === "recovery"
          ? withTimeout(
              acquireGameRoom(connection),
              RECOVERY_TIMEOUT_MS,
              "Unable to restore the match. The room may have ended or expired.",
            )
          : acquireGameRoom(connection));
        if (!isCurrent) {
          return;
        }
        setRoom(currentRoom);
        setIsConnecting(false);
        setConnectionStatus("connected");
        persistGameSession(currentRoom.getRecoveryToken(), source);

        /**
         * Mirror authoritative match state into render-friendly client state.
         *
         * This runs once with the room's current state to cover refresh recovery,
         * then again for every subsequent server patch.
         */
        const syncState = (state: MatchState) => {
          if (!isReadyMatchState(state)) return;

          setGameState(state);

          const colorMap = new Map<string, number>();
          const nameMap = new Map<string, string>();
          state.publicPlayers.forEach((player) => {
            colorMap.set(player.id, player.color);
            nameMap.set(player.id, player.displayName);
          });
          setPlayerColors(colorMap);
          setPlayerNames(nameMap);

          const myId = currentRoom.sessionId;

          const myVision = state.clientVisions.get(myId);
          if (myVision && state.width > 0) {
            const newGrid = createRenderGrid(
              myVision,
              state.width,
              state.height,
            );
            setRenderGrid(newGrid);
          }

          const myQueue = state.clientActionQueues.get(myId);
          if (myQueue) {
            const newQueue = myQueue.queue.map((action: ActionData) => ({
              from: { x: action.fromX, y: action.fromY },
              direction: getDirection(
                { x: action.fromX, y: action.fromY },
                { x: action.toX, y: action.toY },
              ),
            }));
            setMoveQueue(newQueue);
          }
        };

        syncState(currentRoom.state);

        unsubscribers.push(
          currentRoom.onStateChange((state) => {
            syncState(state);
          }),
        );
        unsubscribers.push(
          currentRoom.onMessage(MatchServerMessage.GAME_END, (result) => {
            setGameResult(result);
          }),
        );
        unsubscribers.push(
          currentRoom.onStatusChange((status) => {
            setConnectionStatus(status);
          }),
        );
      } catch (error) {
        if (!isCurrent) return;
        if (connection.type === "recovery") {
          clearPersistedGameSession();
        }
        setIsConnecting(false);
        setError(
          error instanceof Error ? error.message : "Failed to connect to match",
        );
      }
    };

    connect();

    return () => {
      isCurrent = false;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      releaseGameRoom(connection);
    };
  }, [connection, source]);

  const sendMove = (from: ICoordinate, to: ICoordinate) => {
    if (!room) return;
    room.send(MatchClientMessage.ACTION, {
      playerId: room.sessionId,
      type: ActionType.MOVE,
      from,
      to,
    });
  };

  return {
    room,
    renderGrid,
    moveQueue,
    gameState,
    gameResult,
    sendMove,
    playerColors,
    playerNames,
    connectionStatus,
    error,
    isConnecting,
  };
}
