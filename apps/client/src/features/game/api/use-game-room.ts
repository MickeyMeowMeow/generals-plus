import type { ISeatReservation } from "@colyseus/sdk/Client";
import type {
  ICoordinate,
  IGameResult,
  MoveActionType,
} from "@generals-plus/engine";
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
import { useCallback, useEffect, useState } from "react";

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

const DISCONNECTED_MESSAGE = "Your connection to the match was lost.";

export interface GameRoomConnection {
  /** Consume a server-issued seat reservation for the first match entry. */
  type: "reservation";
  reservation: ISeatReservation;
}

/**
 * Shared client-side handle for one consumed match-room seat reservation.
 *
 * Colyseus seat reservations are a one-time handoff from queue/setup into the
 * match room. React can briefly mount, unmount, and remount the game page
 * around that handoff, especially during route transitions or StrictMode.
 */
interface SharedGameConnection {
  promise: Promise<GameRoomClient>;
  room: GameRoomClient | null;
  refs: number;
}

const gameConnections = new Map<string, SharedGameConnection>();

export function resetGameConnectionsForTesting() {
  gameConnections.clear();
}

function getReservationKey(reservation: ISeatReservation) {
  return `${reservation.name}:${reservation.roomId}:${reservation.sessionId}`;
}

function getConnectionKey(connection: GameRoomConnection) {
  return getReservationKey(connection.reservation);
}

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
    promise: networkProvider
      .consumeSeatReservation<
        MatchState,
        MatchClientMessagePayload,
        MatchServerMessagePayload
      >(connection.reservation)
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
 * Release one mounted game page's reference to a consumed match room.
 *
 * Unlike setup/queue rooms, match-room `leave()` is gameplay-significant:
 * `MatchRoom.onLeave` treats it as surrender. React cleanup can run for benign
 * reasons such as StrictMode probes or route handoffs, so it must not actively
 * leave or discard the match.
 */
function releaseGameRoom(connection: GameRoomConnection) {
  const key = getConnectionKey(connection);
  const entry = gameConnections.get(key);
  if (!entry) return;

  entry.refs = Math.max(0, entry.refs - 1);
}

function getDirection(from: ICoordinate, to: ICoordinate): MoveDirection {
  if (to.y < from.y) return MoveDirection.UP;
  if (to.y > from.y) return MoveDirection.DOWN;
  if (to.x < from.x) return MoveDirection.LEFT;
  return MoveDirection.RIGHT;
}

function isReadyMatchState(state: MatchState) {
  return Boolean(
    state.publicPlayers &&
      state.clientVisions &&
      state.clientActionQueues &&
      state.players,
  );
}

export function useGameRoom(connection: GameRoomConnection) {
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
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(
    null,
  );
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const unsubscribers: Array<() => void> = [];

    const connect = async () => {
      setIsConnecting(true);
      setError(null);
      setDisconnectMessage(null);
      setGameResult(null);

      try {
        const currentRoom = await acquireGameRoom(connection);
        if (!isCurrent) {
          return;
        }

        setRoom(currentRoom);
        setIsConnecting(false);

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
            setRenderGrid(
              createRenderGrid(myVision, state.width, state.height),
            );
          }

          const myQueue = state.clientActionQueues.get(myId);
          if (myQueue) {
            setMoveQueue(
              myQueue.queue.map((action: ActionData) => ({
                from: { x: action.fromX, y: action.fromY },
                direction: getDirection(
                  { x: action.fromX, y: action.fromY },
                  { x: action.toX, y: action.toY },
                ),
                type: action.type as MoveActionType,
              })),
            );
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
          currentRoom.onError((_code, message) => {
            if (!isCurrent) return;
            const nextMessage = message?.trim() || DISCONNECTED_MESSAGE;
            setDisconnectMessage((prev) => prev ?? nextMessage);
          }),
        );
        unsubscribers.push(
          currentRoom.onLeave((code, reason) => {
            if (!isCurrent || code === 1000) return;
            const nextMessage = reason?.trim() || DISCONNECTED_MESSAGE;
            setDisconnectMessage((prev) => prev ?? nextMessage);
          }),
        );
      } catch (error) {
        if (!isCurrent) return;
        setIsConnecting(false);
        setError(
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Failed to connect to match",
        );
      }
    };

    void connect();

    return () => {
      isCurrent = false;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      releaseGameRoom(connection);
    };
  }, [connection]);

  const sendMove = useCallback(
    (
      from: ICoordinate,
      to: ICoordinate,
      type: MoveActionType = ActionType.MOVE,
    ) => {
      room?.send(MatchClientMessage.ACTION, {
        playerId: room.sessionId,
        type,
        from,
        to,
      });
    },
    [room],
  );

  const clearMoveQueue = useCallback(() => {
    setMoveQueue([]);
    room?.send(MatchClientMessage.CLEAR_QUEUE);
  }, [room]);

  return {
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
    disconnectMessage,
    isConnecting,
  };
}
