import type { GameMode } from "@generals-plus/engine";
import type { SeatReservation } from "@generals-plus/shared-types";
import { QueueServerMessage } from "@generals-plus/shared-types";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Stage } from "#/components/layout";
import { DEFAULT_GAME_MODE } from "#/config/ui-constants";
import { AuthStatus } from "#/features/auth/auth-store";
import { useAuth } from "#/features/auth/hooks";
import { AuthPage } from "#/features/auth/pages/auth-page";
import { GamePage } from "#/features/game/pages/game-page";
import { QueuePage } from "#/features/game/pages/queue-page";
import { LobbyPage } from "#/features/lobby/pages/lobby-page";
import { networkProvider } from "#/infra/network/provider";

type OfficialPhase = "lobby" | "queue" | "vs-ai";

export default function Index() {
  const { state } = useAuth();
  const [phase, setPhase] = useState<OfficialPhase>("lobby");
  const [selectedMode, setSelectedMode] = useState<GameMode>(DEFAULT_GAME_MODE);
  const [vsAiReservation, setVsAiReservation] =
    useState<SeatReservation | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vsAiRoomRef = useRef<any>(null);

  const handleVsAi = async () => {
    const available = await networkProvider.checkAiHealth();
    if (!available) {
      toast.error("AI service unavailable", {
        description: "Please start the bot service and try again.",
      });
      return;
    }
    setPhase("vs-ai");
    networkProvider
      .joinOrCreate("vs-ai")
      .then((room) => {
        vsAiRoomRef.current = room;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (room as any).onMessage(
          QueueServerMessage.SEAT_RESERVATION,
          (reservation: SeatReservation) => {
            setVsAiReservation(reservation);
            // Leave the matchmaking room once we have a game reservation
            room.leave();
            vsAiRoomRef.current = null;
          },
        );
      })
      .catch((err) => {
        const errMsg =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && "message" in err
              ? String((err as { message: unknown }).message)
              : String(err || "Failed to start AI game");
        toast.error(errMsg);
        setPhase("lobby");
      });
  };

  if (state.status !== AuthStatus.AUTHENTICATED) {
    return (
      <Stage>
        <AuthPage />
      </Stage>
    );
  }

  if (phase === "queue") {
    return (
      <QueuePage gameMode={selectedMode} onLeave={() => setPhase("lobby")} />
    );
  }

  if (phase === "vs-ai" && vsAiReservation) {
    return (
      <GamePage
        connection={{ type: "reservation", reservation: vsAiReservation }}
        source={{
          type: "official",
          onReturn: () => {
            vsAiRoomRef.current?.leave();
            vsAiRoomRef.current = null;
            setPhase("lobby");
            setVsAiReservation(null);
          },
        }}
      />
    );
  }

  return (
    <Stage>
      <LobbyPage
        onQueue={(mode) => {
          setSelectedMode(mode);
          setPhase("queue");
        }}
        onVsAi={handleVsAi}
      />
    </Stage>
  );
}
