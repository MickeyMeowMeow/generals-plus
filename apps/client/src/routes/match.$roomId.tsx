import { useParams } from "react-router";

import { ErrorPanel, Stage, StageCenter } from "#/components/layout";
import { AuthStatus } from "#/features/auth/auth-store";
import { useAuth } from "#/features/auth/hooks";
import { AuthPage } from "#/features/auth/pages/auth-page";
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
  const { state } = useAuth();

  return (
    <Stage>
      {state.status !== AuthStatus.AUTHENTICATED ? (
        <AuthPage />
      ) : roomId ? (
        <CustomSetupRoom roomId={roomId} />
      ) : (
        <StageCenter>
          <ErrorPanel message="This match URL does not contain a room id." />
        </StageCenter>
      )}
    </Stage>
  );
}
