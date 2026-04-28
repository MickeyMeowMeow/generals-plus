import type { Room, SeatReservation } from "@colyseus/sdk";
import type { SetupState } from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { colyseusClient } from "#/features/game/api/colyseus-client";

export function useSetupRoom() {
  const [room, setRoom] = useState<Room<SetupState> | null>(null);
  const [setupState, setSetupState] = useState<SetupState | null>(null);

  const [seatReservation, setSeatReservation] =
    useState<SeatReservation | null>(null);

  useEffect(() => {
    let currentRoom: Room<SetupState>;

    const connect = async () => {
      try {
        currentRoom = await colyseusClient.joinOrCreate<SetupState>("setup");

        setRoom(currentRoom);

        currentRoom.onStateChange((state) => {
          console.log("Received new setup state", state);
          setSetupState(state.clone());
        });

        // Listen for the start game transition
        currentRoom.onMessage("seat", (reservation) => {
          console.log(
            "Received seat reservation, transitioning to game room...",
            reservation,
          );
          setSeatReservation(reservation);
        });
      } catch (e) {
        console.error("Failed to join setup room", e);
      }
    };

    connect();

    return () => {
      if (currentRoom) currentRoom.leave();
    };
  }, []);

  const startGame = () => {
    room?.send("start");
  };

  return { room, setupState, seatReservation, startGame };
}
