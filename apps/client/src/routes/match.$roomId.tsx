import type { GameMode } from "@generals-plus/engine";
import { SetupClientMessage } from "@generals-plus/shared-types";
import { LogOut, Play } from "lucide-react";
import type { SubmitEvent } from "react";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ColorPicker } from "#/components/game/color-picker";
import { Button } from "#/components/ui/button";
import { AuthStatus } from "#/features/auth/auth-store";
import { AuthForm } from "#/features/auth/components/auth-form";
import { useAuth, useUser } from "#/features/auth/hooks";
import { useSetupRoom } from "#/features/game/api/use-setup-room";
import {
  BrandTitle,
  ErrorPanel,
  GameStage,
  LoadingPanel,
  StageCenter,
} from "#/features/game/components/game-stage";
import {
  ModeSelect,
  RoomPlayerList,
} from "#/features/game/components/room-controls";
import { GamePage } from "#/features/game/pages/game-page";

/**
 * Auth scene shown on custom room URLs before the user has a session.
 *
 * The route stays on `/match/:roomId` while auth completes so shared room links
 * remain valid. Once authenticated, `MatchRoute` continues into the setup-room
 * connection using the same URL parameter.
 */
function MatchAuthScreen() {
  const [displayNameInput, setDisplayNameInput] = useState("Commander");
  const { state, actions } = useAuth();

  const handleSignIn = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      await actions.signInAnonymously(displayNameInput);
    },
    [actions.signInAnonymously, displayNameInput],
  );

  if (
    !state.isHydrated ||
    state.status === AuthStatus.HYDRATING ||
    state.status === AuthStatus.AUTHENTICATING
  ) {
    return <LoadingPanel message="Checking session" />;
  }

  return (
    <StageCenter>
      <div className="mx-auto grid max-w-4xl gap-7">
        <BrandTitle />
        <div className="mx-auto w-full max-w-md">
          <AuthForm
            displayName={displayNameInput}
            onDisplayNameChange={setDisplayNameInput}
            isBusy={false}
            lastError={state.error}
            onSignIn={handleSignIn}
          />
        </div>
      </div>
    </StageCenter>
  );
}

/**
 * Custom-room setup/game scene for `/match/:roomId`.
 *
 * The route first joins the setup room identified by the URL. While setup is
 * active it renders the room lobby, host-only start control, player list, and
 * color picker. When the setup room emits a seat reservation, the same route
 * swaps into `GamePage` and consumes that reservation to enter the match room.
 */
function CustomSetupRoom({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const userId = useUser((user) => user?.id);
  const displayName = useUser((user) => user?.displayName ?? "Commander");
  const {
    room,
    setupState,
    seatReservation,
    startGame,
    updateSettings,
    clearSeatReservation,
    error,
    isConnecting,
  } = useSetupRoom({ roomId });

  if (seatReservation) {
    return (
      <GamePage
        reservation={seatReservation}
        source={{
          type: "custom",
          setupRoomId: roomId,
          onReturn: clearSeatReservation,
        }}
      />
    );
  }

  if (error) {
    return (
      <StageCenter>
        <ErrorPanel
          title="Room unavailable"
          message={`${error}. Check the shared URL or ask the host for a fresh room link.`}
        />
      </StageCenter>
    );
  }

  if (isConnecting || !setupState) {
    return <LoadingPanel message="Joining custom room" />;
  }

  const myPlayer = setupState.players.find((player) => player.id === userId);
  const takenColors = setupState.players.map((player) => player.color);
  const isHost = Boolean(myPlayer?.isHost);
  const canStart = isHost && setupState.players.length >= 2;

  return (
    <StageCenter>
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-medium">Hello, {displayName}</p>
            <p className="text-sm text-game-text-dim">
              {isHost ? "You are host" : "You are guest"}
            </p>
          </div>
          <ModeSelect
            value={setupState.gameMode as GameMode}
            disabled={!isHost}
            onChange={(gameMode) => updateSettings({ gameMode })}
          />
        </div>

        <div className="grid gap-8 border-t border-game-border pt-8 md:grid-cols-[1fr_20rem]">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Color</h2>
            {myPlayer ? (
              <ColorPicker
                takenColors={takenColors}
                currentColor={myPlayer.color}
                onSelect={(color) =>
                  room?.send(SetupClientMessage.PICK_COLOR, { color })
                }
              />
            ) : (
              <p className="text-sm text-game-text-dim">
                Waiting for player assignment.
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              {canStart ? (
                <Button type="button" onClick={startGame}>
                  <Play className="size-4" />
                  Force start game
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/")}
              >
                <LogOut className="size-4" />
                Leave room
              </Button>
            </div>
          </section>

          <RoomPlayerList
            players={setupState.players}
            currentUserId={userId}
            maxPlayers={setupState.maxPlayers}
            showHost
          />
        </div>
      </div>
    </StageCenter>
  );
}

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
    <GameStage>
      {state.status !== AuthStatus.AUTHENTICATED ? (
        <MatchAuthScreen />
      ) : roomId ? (
        <CustomSetupRoom roomId={roomId} />
      ) : (
        <StageCenter>
          <ErrorPanel message="This match URL does not contain a room id." />
        </StageCenter>
      )}
    </GameStage>
  );
}
