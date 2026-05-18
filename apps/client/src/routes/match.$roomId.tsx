import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ErrorPanel, Stage, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { AuthStatus } from "#/features/auth/auth-store";
import { useAuth } from "#/features/auth/hooks";
import { AuthPage } from "#/features/auth/pages/auth-page";
import { loadPersistedGameSession } from "#/features/game/api/use-game-room";
import { GamePage } from "#/features/game/pages/game-page";
import { CustomSetupRoom } from "#/features/game/pages/setup-page";

/**
 * Custom-room route container.
 *
 * This is the only supported custom-room entry point. It deliberately handles
 * unauthenticated users in place, invalid URLs as staged errors, and setup/game
 * phase switching without redirecting to the old `match-screen` route.
 */
export default function MatchRoute() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  /**
   * Snapshot any custom match recovery token during route mount.
   *
   * The browser URL remains the stable custom-room URL while the match is in
   * progress. On refresh, this persisted token tells the route to restore the
   * match room instead of trying to re-resolve setup room state first.
   */
  const [persistedGameSession, setPersistedGameSession] = useState(() =>
    loadPersistedGameSession(),
  );

  /**
   * Custom recovery is valid only for the stable room URL that launched the match.
   */
  const customRecoveryToken =
    persistedGameSession?.source.type === "custom" &&
    persistedGameSession.source.customRoomKey === roomId
      ? persistedGameSession.recoveryToken
      : null;

  return (
    <Stage>
      {state.status !== AuthStatus.AUTHENTICATED ? (
        <AuthPage />
      ) : roomId && customRecoveryToken ? (
        <GamePage
          connection={{
            type: "recovery",
            recoveryToken: customRecoveryToken,
          }}
          source={{
            type: "custom",
            customRoomKey: roomId,
            onReturn: () => {
              setPersistedGameSession(null);
            },
          }}
        />
      ) : roomId ? (
        <CustomSetupRoom roomId={roomId} />
      ) : (
        <StageCenter>
          <ErrorPanel
            message="This match URL does not contain a room id."
            action={
              <Button type="button" onClick={() => navigate("/")}>
                Return to lobby
              </Button>
            }
          />
        </StageCenter>
      )}
    </Stage>
  );
}
