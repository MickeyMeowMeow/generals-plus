import type { ISeatReservation } from "@colyseus/sdk/Client";
import type { ICoordinate } from "@generals-plus/engine";
import { ActionType } from "@generals-plus/engine";
import type {
  ActionData,
  MatchClientMessagePayload,
  MatchServerMessagePayload,
  MatchState,
} from "@generals-plus/shared-types";
import { MatchClientMessage } from "@generals-plus/shared-types";
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

interface SharedGameConnection {
  promise: Promise<GameRoomClient>;
  room: GameRoomClient | null;
  refs: number;
  leaveTimer: ReturnType<typeof setTimeout> | null;
}

const gameConnections = new Map<string, SharedGameConnection>();

function getReservationKey(reservation: ISeatReservation) {
  return `${reservation.name}:${reservation.roomId}:${reservation.sessionId}`;
}

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

function getDirection(from: ICoordinate, to: ICoordinate): MoveDirection {
  if (to.y < from.y) return MoveDirection.UP;
  if (to.y > from.y) return MoveDirection.DOWN;
  if (to.x < from.x) return MoveDirection.LEFT;
  return MoveDirection.RIGHT;
}

export function useGameRoom(reservation: ISeatReservation) {
  const [room, setRoom] = useState<GameRoomClient | null>(null);
  const [renderGrid, setRenderGrid] = useState<RenderGrid | null>(null);
  const [moveQueue, setMoveQueue] = useState<MoveIntent[]>([]);
  const [gameState, setGameState] = useState<MatchState | null>(null);
  const [playerColors, setPlayerColors] = useState<Map<string, number>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!reservation) return;

    let isCurrent = true;

    const connect = async () => {
      setIsConnecting(true);
      setError(null);
      try {
        const currentRoom = await acquireGameRoom(reservation);
        if (!isCurrent) {
          return;
        }
        setRoom(currentRoom);
        setIsConnecting(false);

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
        });
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
    sendMove,
    playerColors,
    error,
    isConnecting,
  };
}
