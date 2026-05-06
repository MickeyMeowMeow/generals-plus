import type { Room, SeatReservation } from "@colyseus/sdk";
import type { QueueState } from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { colyseusClient } from "#/features/game/api/colyseus-client";

export function useQueueRoom() {
  const [room, setRoom] = useState<Room<QueueState> | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [seatReservation, setSeatReservation] =
    useState<SeatReservation | null>(null);

  useEffect(() => {
    let currentRoom: Room<QueueState>;

    const connect = async () => {
      try {
        currentRoom = await colyseusClient.joinOrCreate<QueueState>("queue");

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
