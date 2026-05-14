import { SetupClientMessage } from "@generals-plus/shared-types";
import { Crown, Link as LinkIcon, Play } from "lucide-react";
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
  FloatingHud,
  GameStage,
  LoadingPanel,
  StageCenter,
  StagePanel,
} from "#/features/game/components/game-stage";
import { GamePage } from "#/features/game/pages/game-page";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

function MatchAuthScreen() {
  const [displayNameInput, setDisplayNameInput] = useState("Commander");
  const { state, actions } = useAuth();
  const currentDisplayName = useUser((user) => user?.displayName ?? null);
  const resetMatchConnection = useMatchConnectionStore((s) => s.reset);

  const handleSignIn = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      await actions.signInAnonymously(displayNameInput);
    },
    [actions.signInAnonymously, displayNameInput],
  );

  const handleSignOut = async () => {
    await resetMatchConnection();
    await actions.signOut();
  };

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
            isAuthenticated={state.status === AuthStatus.AUTHENTICATED}
            lastError={state.error}
            authStatus={state.status}
            currentDisplayName={currentDisplayName}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onEnterLobby={() => {}}
          />
        </div>
      </div>
    </StageCenter>
  );
}

function CustomSetupRoom({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const userId = useUser((user) => user?.id);
  const { room, setupState, seatReservation, startGame, error, isConnecting } =
    useSetupRoom({ roomId });

  if (seatReservation) {
    return <GamePage reservation={seatReservation} />;
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
    <>
      <FloatingHud>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-teal-200/80">
            Custom room
          </p>
          <div className="flex items-center gap-2 font-mono text-sm text-game-text-dim">
            <LinkIcon className="size-4" />
            {roomId}
          </div>
        </div>
      </FloatingHud>

      <StageCenter>
        <div className="mx-auto grid max-w-5xl gap-6">
          <BrandTitle compact />
          <StagePanel>
            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
              <div>
                <p className="text-sm font-semibold uppercase text-teal-200/80">
                  Setup phase
                </p>
                <h2 className="mt-1 text-3xl font-black uppercase">
                  Assemble the room
                </h2>

                {myPlayer ? (
                  <div className="mt-6">
                    <p className="mb-3 text-sm text-game-text-dim">
                      Commander color
                    </p>
                    <ColorPicker
                      takenColors={takenColors}
                      currentColor={myPlayer.color}
                      onSelect={(color) =>
                        room?.send(SetupClientMessage.PICK_COLOR, { color })
                      }
                    />
                  </div>
                ) : null}

                <div className="mt-7 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={startGame}
                    disabled={!canStart}
                  >
                    <Play className="size-4" />
                    Start game
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate("/")}
                  >
                    Leave room
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold uppercase text-amber-200">
                  Players {setupState.players.length} / {setupState.maxPlayers}
                </p>
                <ul className="mt-3 space-y-2">
                  {setupState.players.map((player) => (
                    <li
                      key={player.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full"
                          style={{
                            backgroundColor: `#${player.color
                              .toString(16)
                              .padStart(6, "0")}`,
                          }}
                        />
                        {player.displayName}
                      </span>
                      {player.isHost ? (
                        <Crown className="size-4 text-amber-300" />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </StagePanel>
        </div>
      </StageCenter>
    </>
  );
}

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
