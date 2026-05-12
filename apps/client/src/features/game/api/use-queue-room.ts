import type {
  QueueClientMessagePayload,
  QueueServerMessagePayload,
  QueueState,
  SeatReservation,
} from "@generals-plus/shared-types";
import { QueueServerMessage } from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { networkProvider } from "#/infra/network/provider";
import type { RoomClient } from "#/infra/network/room";

type QueueRoomClient = RoomClient<
  QueueState,
  QueueClientMessagePayload,
  QueueServerMessagePayload
>;

export function useQueueRoom() {
  const [room, setRoom] = useState<QueueRoomClient | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [seatReservation, setSeatReservation] =
    useState<SeatReservation | null>(null);

  useEffect(() => {
    let currentRoom: QueueRoomClient;

    const connect = async () => {
      try {
        currentRoom = await networkProvider.joinOrCreate<
          QueueState,
          QueueClientMessagePayload,
          QueueServerMessagePayload
        >("queue");

        setRoom(currentRoom);

        currentRoom.onStateChange((state) => {
          setQueueState(state.clone());
        });

        currentRoom.onMessage(
          QueueServerMessage.SEAT_RESERVATION,
          (reservation) => {
            setSeatReservation(reservation);
          },
        );
      } catch (e) {
        console.error("Failed to join queue room", e);
      }
    };

    connect();

    return () => {
      if (currentRoom) currentRoom.leave();
    };
  }, []);

  return { room, queueState, seatReservation };
}
