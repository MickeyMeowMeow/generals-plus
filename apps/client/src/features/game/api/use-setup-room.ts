import type {
  SeatReservation,
  SetupClientMessagePayload,
  SetupServerMessagePayload,
  SetupState,
} from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { networkProvider } from "#/infra/network/provider";
import type { RoomClient } from "#/infra/network/room";

type SetupRoomClient = RoomClient<
  SetupState,
  SetupClientMessagePayload,
  SetupServerMessagePayload
>;

export function useSetupRoom() {
  const [room, setRoom] = useState<SetupRoomClient | null>(null);
  const [setupState, setSetupState] = useState<SetupState | null>(null);

  const [seatReservation, setSeatReservation] =
    useState<SeatReservation | null>(null);

  useEffect(() => {
    let currentRoom: SetupRoomClient;

    const connect = async () => {
      try {
        currentRoom = await networkProvider.joinOrCreate<
          SetupState,
          SetupClientMessagePayload,
          SetupServerMessagePayload
        >("setup");

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
