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
  /** Delayed room leave scheduled when the last consumer releases it. */
  leaveTimer: ReturnType<typeof setTimeout> | null;
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
 * Consume or reuse a match-room seat reservation.
 *
 * The first caller starts the Colyseus consume request and stores its promise.
 * Later callers with the same reservation key reuse that promise/room, canceling
 * any pending delayed leave if the connection was about to be released.
 */
function acquireGameRoom(reservation: ISeatReservation) {
  const key = getReservationKey(reservation);
  let entry = gameConnections.get(key);

  if (entry) {
    entry.refs++;
    if (entry.leaveTimer) {
      clearTimeout(entry.leaveTimer);
      entry.leaveTimer = null;
    }
    return entry.promise;
  }

  entry = {
    refs: 1,
    room: null,
    leaveTimer: null,
    promise: networkProvider
      .consumeSeatReservation<
        MatchState,
        MatchClientMessagePayload,
        MatchServerMessagePayload
      >(reservation)
      .then((room) => {
        const current = gameConnections.get(key);
        if (current) current.room = room;
        return room;
      }),
  };
  gameConnections.set(key, entry);
  return entry.promise;
}

/**
 * Release one mounted game page's reference to a consumed match room.
 *
 * The connection is left only after the final consumer has been gone for a short
 * delay. That delay keeps a valid match socket alive through fast remounts while
 * still cleaning up when the user actually leaves the game view.
 */
function releaseGameRoom(reservation: ISeatReservation) {
  const key = getReservationKey(reservation);
  const entry = gameConnections.get(key);
  if (!entry) return;

  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0 || entry.leaveTimer) return;

  entry.leaveTimer = setTimeout(() => {
    const current = gameConnections.get(key);
    if (!current || current.refs > 0) return;
    gameConnections.delete(key);
    void current.promise.then((room) => room.leave()).catch(() => {});
  }, 500);
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
 * Connect the game page to a reserved Colyseus match room.
 *
 * The hook consumes the seat reservation, subscribes to authoritative match
 * state, adapts the current client's vision schema into a render grid, mirrors
 * the player's server-side action queue for the movement overlay, and exposes a
 * typed `sendMove` command for user input.
 */
export function useGameRoom(reservation: ISeatReservation) {
  const [room, setRoom] = useState<GameRoomClient | null>(null);
  const [renderGrid, setRenderGrid] = useState<RenderGrid | null>(null);
  const [moveQueue, setMoveQueue] = useState<MoveIntent[]>([]);
  const [gameState, setGameState] = useState<MatchState | null>(null);
  const [gameResult, setGameResult] = useState<IGameResult | null>(null);
  const [playerColors, setPlayerColors] = useState<Map<string, number>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  useEffect(() => {
    if (!reservation) return;

    let isCurrent = true;
    const unsubscribers: Array<() => void> = [];

    const connect = async () => {
      setIsConnecting(true);
      setError(null);
      setGameResult(null);
      setConnectionStatus("connecting");
      try {
        const currentRoom = await acquireGameRoom(reservation);
        if (!isCurrent) {
          return;
        }
        setRoom(currentRoom);
        setIsConnecting(false);
        setConnectionStatus("connected");

        unsubscribers.push(
          currentRoom.onStateChange((state) => {
            setGameState(state);

            const colorMap = new Map<string, number>();
            state.playerColors.forEach((color, playerId) => {
              colorMap.set(playerId, color);
            });
            setPlayerColors(colorMap);

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
        setIsConnecting(false);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to consume seat reservation",
        );
      }
    };

    connect();

    return () => {
      isCurrent = false;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      releaseGameRoom(reservation);
    };
  }, [reservation]);

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
    connectionStatus,
    error,
    isConnecting,
  };
}
