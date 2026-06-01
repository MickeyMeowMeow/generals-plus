import { useNavigate, useParams } from "react-router";

import { ErrorPanel, Stage, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { AuthStatus } from "#/features/auth/auth-store";
import { useAuth } from "#/features/auth/hooks";
import { AuthPage } from "#/features/auth/pages/auth-page";
import { CustomSetupRoom } from "#/features/staging/pages/setup-page";

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

  return (
    <Stage>
      {state.status !== AuthStatus.AUTHENTICATED ? (
        <AuthPage />
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
