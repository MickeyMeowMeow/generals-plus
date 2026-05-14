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

interface UseQueueRoomOptions {
  /** Whether the hook should open the Colyseus queue room connection. */
  enabled?: boolean;
  /** Official game mode requested by the root-route lobby. */
  gameMode?: GameMode;
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

    let currentRoom: QueueRoomClient;
    let isCurrent = true;

    const connect = async () => {
      setIsConnecting(true);
      setError(null);
      try {
        currentRoom = await networkProvider.joinOrCreate<
          QueueState,
          QueueClientMessagePayload,
          QueueServerMessagePayload
        >(ROOM_NAMES.QUEUE, { gameMode });

        if (!isCurrent) {
          await currentRoom.leave();
          return;
        }
        setRoom(currentRoom);
        setIsConnecting(false);

        currentRoom.onStateChange((state) => {
          setQueueState(state.clone());
        });

        currentRoom.onMessage(
          QueueServerMessage.SEAT_RESERVATION,
          (reservation) => {
            setSeatReservation(reservation);
            currentRoom.send(QueueClientMessage.CONFIRM);
          },
        );
        currentRoom.onMessage(QueueServerMessage.ERROR, (message) => {
          setError(message);
        });
      } catch (e) {
        if (!isCurrent) return;
        setIsConnecting(false);
        setError(e instanceof Error ? e.message : "Failed to join queue room");
      }
    };

    connect();

    return () => {
      isCurrent = false;
      if (currentRoom) void currentRoom.leave();
    };
  }, [enabled, gameMode]);

  return { room, queueState, seatReservation, error, isConnecting };
}
