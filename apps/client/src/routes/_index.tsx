import { QueueClientMessage } from "@generals-plus/shared-types";
import { Shield, Sparkles, Swords } from "lucide-react";
import type { SubmitEvent } from "react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { ColorPicker } from "#/components/game/color-picker";
import { Button } from "#/components/ui/button";
import { OFFICIAL_GAME_MODES } from "#/config/ui-constants";
import { AuthStatus } from "#/features/auth/auth-store";
import { AuthForm } from "#/features/auth/components/auth-form";
import { useAuth, useUser } from "#/features/auth/hooks";
import { useQueueRoom } from "#/features/game/api/use-queue-room";
import { createCustomSetupRoom } from "#/features/game/api/use-setup-room";
import {
  BrandTitle,
  ErrorPanel,
  GameStage,
  LoadingPanel,
  StageCenter,
  StagePanel,
} from "#/features/game/components/game-stage";
import { GamePage } from "#/features/game/pages/game-page";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

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
 * Root-route unauthenticated scene.
 *
 * The rebuilt client no longer has a `/user` route, so login/register behavior
 * lives directly inside `/`. Successful auth simply allows the root route to
 * render the official lobby without navigating.
 */
function AuthScreen() {
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

/**
 * Authenticated official lobby scene.
 *
 * This screen exposes only the supported Classic official mode and a create-only
 * custom-room entry. Joining custom rooms is intentionally URL-based, so the
 * lobby creates a private setup room and then navigates to `/match/:roomId`.
 */
function LobbyScreen({ onQueue }: { onQueue: () => void }) {
  const navigate = useNavigate();
  const { actions } = useAuth();
  const displayName = useUser((user) => user?.displayName ?? "Commander");
  const resetMatchConnection = useMatchConnectionStore((s) => s.reset);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const createCustomRoom = async () => {
    setIsCreatingCustom(true);
    setCustomError(null);
    try {
      const room = await createCustomSetupRoom();
      navigate(`/match/${encodeURIComponent(room.roomId)}`);
    } catch (error) {
      setCustomError(
        error instanceof Error ? error.message : "Failed to create custom room",
      );
    } finally {
      setIsCreatingCustom(false);
    }
  };

  const signOut = async () => {
    await resetMatchConnection();
    await actions.signOut();
  };

  const classic = OFFICIAL_GAME_MODES[0];

  return (
    <StageCenter>
      <div className="mx-auto grid max-w-5xl gap-7">
        <BrandTitle />
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <StagePanel className="min-h-80">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase text-teal-200/80">
                    Official queue
                  </p>
                  <h2 className="mt-1 text-3xl font-black uppercase">
                    Choose operation
                  </h2>
                </div>
                <Shield className="size-9 text-amber-300" />
              </div>

              <button
                type="button"
                onClick={onQueue}
                className="group relative overflow-hidden rounded-lg border border-white/15 bg-black/30 p-5 text-left transition hover:-translate-y-0.5 hover:border-teal-200/60 hover:bg-teal-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase text-amber-200">
                      Play {classic.label}
                    </p>
                    <h3 className="mt-2 text-2xl font-black">
                      {classic.tagline}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-game-text-dim">
                      {classic.description}
                    </p>
                  </div>
                  <Swords className="size-8 text-teal-200 transition group-hover:scale-110" />
                </div>
              </button>
            </div>
          </StagePanel>

          <StagePanel className="flex flex-col justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase text-teal-200/80">
                Commander
              </p>
              <h2 className="mt-1 text-2xl font-black">{displayName}</h2>
              <p className="mt-3 text-sm leading-6 text-game-text-dim">
                Custom rooms are shared by URL after creation.
              </p>
            </div>

            {customError ? (
              <p className="rounded-md border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">
                {customError}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Button
                type="button"
                onClick={createCustomRoom}
                disabled={isCreatingCustom}
                className="justify-center"
              >
                <Sparkles className="size-4" />
                {isCreatingCustom ? "Creating..." : "Create custom room"}
              </Button>
              <Button type="button" variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </StagePanel>
        </div>
      </div>
    </StageCenter>
  );
}

/**
 * Official queue scene inside the root route.
 *
 * The scene owns the queue-room hook while it is mounted. Color selection sends
 * queue protocol messages, and receipt of a seat reservation swaps the scene
 * directly into `GamePage` without changing the URL.
 */
function QueueScreen({ onLeave }: { onLeave: () => void }) {
  const { room, queueState, seatReservation, error, isConnecting } =
    useQueueRoom();
  const userId = useUser((user) => user?.id);

  if (seatReservation) {
    return <GamePage reservation={seatReservation} />;
  }

  if (error) return <ErrorPanel message={error} />;

  if (isConnecting || !queueState) {
    return <LoadingPanel message="Joining official queue" />;
  }

  const myPlayer = queueState.players.find((p) => p.id === userId);
  const takenColors = queueState.players.map((p) => p.color);

  return (
    <StageCenter>
      <div className="mx-auto grid max-w-4xl gap-5">
        <BrandTitle compact />
        <StagePanel>
          <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
            <div>
              <p className="text-sm font-semibold uppercase text-teal-200/80">
                Official queue
              </p>
              <h2 className="mt-1 text-3xl font-black uppercase">
                Pick your color
              </h2>
              <div className="mt-6">
                {myPlayer ? (
                  <ColorPicker
                    takenColors={takenColors}
                    currentColor={myPlayer.color}
                    onSelect={(color) =>
                      room?.send(QueueClientMessage.PICK_COLOR, { color })
                    }
                  />
                ) : (
                  <p className="text-sm text-game-text-dim">
                    Waiting for player assignment.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold uppercase text-amber-200">
                Players {queueState.players.length}
              </p>
              <ul className="mt-3 space-y-2">
                {queueState.players.map((player) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{
                        backgroundColor: `#${player.color
                          .toString(16)
                          .padStart(6, "0")}`,
                      }}
                    />
                    {player.displayName}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                onClick={onLeave}
                className="mt-5 w-full"
              >
                Leave queue
              </Button>
            </div>
          </div>
        </StagePanel>
      </div>
    </StageCenter>
  );
}

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

  return (
    <GameStage>
      {state.status !== AuthStatus.AUTHENTICATED ? (
        <AuthScreen />
      ) : phase === "queue" ? (
        <QueueScreen onLeave={() => setPhase("lobby")} />
      ) : (
        <LobbyScreen onQueue={() => setPhase("queue")} />
      )}
    </GameStage>
  );
}
