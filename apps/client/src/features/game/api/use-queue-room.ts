import type {
  QueueState,
  SeatReservation,
  SetupClientMessagePayload,
  SetupServerMessagePayload,
} from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { networkProvider } from "#/infra/network/provider";
import type { RoomClient } from "#/infra/network/room";

type QueueRoomClient = RoomClient<
  QueueState,
  SetupClientMessagePayload,
  SetupServerMessagePayload
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
          never,
          SetupServerMessagePayload
        >("queue");

        setRoom(currentRoom);

        currentRoom.onStateChange((state) => {
          setQueueState(state.clone());
        });

        currentRoom.onMessage("seat", (reservation) => {
          setSeatReservation(reservation);
        });
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
