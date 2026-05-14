import type { GameMode } from "@generals-plus/engine";
import { useState } from "react";

import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { AuthStatus } from "#/features/auth/auth-store";
import { useAuth } from "#/features/auth/hooks";
import { AuthPage } from "#/features/auth/pages/auth-page";
import { GameStage } from "#/features/game/components/game-stage";
import { QueuePage } from "#/features/game/pages/queue-page";
import { LobbyPage } from "#/features/lobby/pages/lobby-page";

/**
 * Client-only phase for the official `/` route.
 *
 * Auth is handled separately by `AuthStatus`; once authenticated, the root route
 * intentionally keeps the URL stable and switches between the lobby scene and
 * queue scene in memory. The actual match phase is driven by a Colyseus seat
 * reservation, not by another route.
 */
type OfficialPhase = "lobby" | "queue";

/**
 * Official-flow route container.
 *
 * `/` is the single entry point for unauthenticated auth, official lobby,
 * official queue, and official match rendering. Keeping these states in one
 * route avoids stale legacy URLs and matches the backend room lifecycle.
 */
export default function Index() {
  const { state } = useAuth();
  const [phase, setPhase] = useState<OfficialPhase>("lobby");
  const [selectedMode, setSelectedMode] = useState<GameMode>(
    GAME_MODE_OPTIONS[0].id,
  );

  return (
    <GameStage>
      {state.status !== AuthStatus.AUTHENTICATED ? (
        <AuthPage />
      ) : phase === "queue" ? (
        <QueuePage gameMode={selectedMode} onLeave={() => setPhase("lobby")} />
      ) : (
        <LobbyPage
          onQueue={(mode) => {
            setSelectedMode(mode);
            setPhase("queue");
          }}
        />
      )}
    </GameStage>
  );
}
