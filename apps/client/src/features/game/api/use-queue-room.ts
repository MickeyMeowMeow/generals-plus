import { GameMode } from "@generals-plus/engine";
import type {
  QueueClientMessagePayload,
  QueueServerMessagePayload,
  QueueState,
  SeatReservation,
} from "@generals-plus/shared-types";
import {
  QueueClientMessage,
  QueueServerMessage,
  ROOM_NAMES,
} from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { networkProvider } from "#/infra/network/provider";
import type { RoomClient } from "#/infra/network/room";

type QueueRoomClient = RoomClient<
  QueueState,
  QueueClientMessagePayload,
  QueueServerMessagePayload
>;

interface SharedQueueConnection {
  promise: Promise<QueueRoomClient>;
  room: QueueRoomClient | null;
  refs: number;
  leaveTimer: ReturnType<typeof setTimeout> | null;
}

const queueConnections = new Map<string, SharedQueueConnection>();

export function resetQueueConnectionsForTesting() {
  queueConnections.clear();
}

interface UseQueueRoomOptions {
  /** Whether the hook should open the Colyseus queue room connection. */
  enabled?: boolean;
  /** Official game mode requested by the root-route lobby. */
  gameMode?: GameMode;
}

function getQueueKey(gameMode: GameMode) {
  return `${ROOM_NAMES.QUEUE}:${gameMode}`;
}

function acquireQueueRoom(gameMode: GameMode) {
  const key = getQueueKey(gameMode);
  let entry = queueConnections.get(key);

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
      .joinOrCreate<
        QueueState,
        QueueClientMessagePayload,
        QueueServerMessagePayload
      >(ROOM_NAMES.QUEUE, { gameMode })
      .then((room) => {
        const current = queueConnections.get(key);
        if (current) current.room = room;
        return room;
      })
      .catch((error) => {
        if (queueConnections.get(key) === entry) {
          queueConnections.delete(key);
        }
        throw error;
      }),
  };
  queueConnections.set(key, entry);
  return entry.promise;
}

function releaseQueueRoom(gameMode: GameMode) {
  const key = getQueueKey(gameMode);
  const entry = queueConnections.get(key);
  if (!entry) return;

  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0 || entry.leaveTimer) return;

  entry.leaveTimer = setTimeout(() => {
    const current = queueConnections.get(key);
    if (!current || current.refs > 0) return;
    queueConnections.delete(key);
    void current.promise.then((room) => room.leave()).catch(() => {});
  }, 500);
}

/**
 * Connect the official root-route flow to the Colyseus queue room.
 *
 * This hook owns the official matchmaking socket for `/`: it joins or creates
 * the queue room with the selected game mode, mirrors queue state for the color
 * picker and player list, listens for the server seat reservation that promotes
 * the user into a match room, and confirms the handoff with the shared protocol
 * enum. Leaving the queue unmounts the hook and closes the queue socket.
 */
export function useQueueRoom({
  enabled = true,
  gameMode = GameMode.CLASSIC,
}: UseQueueRoomOptions = {}) {
  const [room, setRoom] = useState<QueueRoomClient | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [seatReservation, setSeatReservation] =
    useState<SeatReservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let isCurrent = true;
    const unsubscribers: Array<() => void> = [];

    const connect = async () => {
      setIsConnecting(true);
      setError(null);
      try {
        const currentRoom = await acquireQueueRoom(gameMode);

        if (!isCurrent) {
          return;
        }
        setRoom(currentRoom);
        setIsConnecting(false);

        unsubscribers.push(
          currentRoom.onStateChange((state) => {
            setQueueState(state.clone());
          }),
        );

        unsubscribers.push(
          currentRoom.onMessage(
            QueueServerMessage.SEAT_RESERVATION,
            (reservation) => {
              setSeatReservation(reservation);
              currentRoom.send(QueueClientMessage.CONFIRM);
            },
          ),
        );
        unsubscribers.push(
          currentRoom.onMessage(QueueServerMessage.ERROR, (message) => {
            setError(message);
          }),
        );
      } catch (e) {
        if (!isCurrent) return;
        setIsConnecting(false);
        setError(e instanceof Error ? e.message : "Failed to join queue room");
      }
    };

    connect();

    return () => {
      isCurrent = false;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      releaseQueueRoom(gameMode);
    };
  }, [enabled, gameMode]);

  return { room, queueState, seatReservation, error, isConnecting };
}
