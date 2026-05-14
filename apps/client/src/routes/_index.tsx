import type { GameMode } from "@generals-plus/engine";
import { QueueClientMessage } from "@generals-plus/shared-types";
import { LogOut, Play, Plus, X } from "lucide-react";
import type { SubmitEvent } from "react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { ColorPicker } from "#/components/game/color-picker";
import { Button } from "#/components/ui/button";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
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
} from "#/features/game/components/game-stage";
import { RoomPlayerList } from "#/features/game/components/room-controls";
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

function getModeOption(mode: GameMode) {
  return GAME_MODE_OPTIONS.find((option) => option.id === mode);
}

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

function ModePickerDialog({
  onClose,
  onSelectMode,
}: {
  onClose: () => void;
  onSelectMode: (mode: GameMode) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-picker-title"
        className="game-panel max-h-[min(42rem,calc(100svh-2rem))] w-full max-w-3xl overflow-auto rounded-lg p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="mode-picker-title" className="text-xl font-semibold">
            Choose mode
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close mode picker"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_MODE_OPTIONS.map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={!mode.isEnabled}
              onClick={() => onSelectMode(mode.id)}
              className="rounded-lg border border-game-border bg-game-bg p-4 text-left transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="block text-base font-semibold">
                {mode.label}
              </span>
              <span className="mt-2 block text-sm leading-5 text-game-text-dim">
                {mode.description}
              </span>
              {!mode.isEnabled ? (
                <span className="mt-3 block text-xs text-game-text-dim">
                  Coming soon
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Authenticated official lobby scene.
 *
 * The lobby keeps the root route stable, offers a mode picker before official
 * queueing, and creates private custom setup rooms by URL.
 */
function LobbyScreen({ onQueue }: { onQueue: (mode: GameMode) => void }) {
  const navigate = useNavigate();
  const { actions } = useAuth();
  const displayName = useUser((user) => user?.displayName ?? "Commander");
  const resetMatchConnection = useMatchConnectionStore((s) => s.reset);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);

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

  return (
    <>
      {isModePickerOpen ? (
        <ModePickerDialog
          onClose={() => setIsModePickerOpen(false)}
          onSelectMode={(mode) => {
            setIsModePickerOpen(false);
            onQueue(mode);
          }}
        />
      ) : null}

      <StageCenter>
        <div className="mx-auto grid max-w-5xl gap-8">
          <BrandTitle />

          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-medium">Hello, {displayName}</p>
            <Button type="button" variant="ghost" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>

          <section className="grid min-h-56 place-items-center border-t border-game-border pt-8">
            <Button
              type="button"
              size="lg"
              onClick={() => setIsModePickerOpen(true)}
              className="min-w-36"
            >
              <Play className="size-4" />
              Start
            </Button>
          </section>

          <section className="grid min-h-44 place-items-center border-t border-game-border pt-8">
            <div className="grid justify-items-center gap-3">
              <Button
                type="button"
                onClick={createCustomRoom}
                disabled={isCreatingCustom}
                className="min-w-48 justify-center"
              >
                <Plus className="size-4" />
                {isCreatingCustom ? "Creating..." : "Create custom room"}
              </Button>

              {customError ? (
                <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
                  {customError}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </StageCenter>
    </>
  );
}

/**
 * Official queue scene inside the root route.
 *
 * The scene owns the queue-room hook while it is mounted. Color selection sends
 * queue protocol messages, and receipt of a seat reservation swaps the scene
 * directly into `GamePage` without changing the URL.
 */
function QueueScreen({
  gameMode,
  onLeave,
}: {
  gameMode: GameMode;
  onLeave: () => void;
}) {
  const { room, queueState, seatReservation, error, isConnecting } =
    useQueueRoom({ gameMode });
  const userId = useUser((user) => user?.id);
  const displayName = useUser((user) => user?.displayName ?? "Commander");
  const modeLabel = getModeOption(gameMode)?.label ?? gameMode;

  if (seatReservation) {
    return (
      <GamePage
        reservation={seatReservation}
        source={{ type: "official", onReturn: onLeave }}
      />
    );
  }

  if (error) return <ErrorPanel message={error} />;

  if (isConnecting || !queueState) {
    return <LoadingPanel message="Joining official queue" />;
  }

  const myPlayer = queueState.players.find((p) => p.id === userId);
  const takenColors = queueState.players.map((p) => p.color);

  return (
    <StageCenter>
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-medium">Hello, {displayName}</p>
          <p className="text-sm text-game-text-dim">Mode: {modeLabel}</p>
        </div>

        <div className="grid gap-8 border-t border-game-border pt-8 md:grid-cols-[1fr_20rem]">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Color</h2>
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
          </section>

          <div className="space-y-5">
            <RoomPlayerList
              players={queueState.players}
              currentUserId={userId}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={onLeave}
              className="w-full"
            >
              Leave queue
            </Button>
          </div>
        </div>
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
  const [selectedMode, setSelectedMode] = useState<GameMode>(
    GAME_MODE_OPTIONS[0].id,
  );

  return (
    <GameStage>
      {state.status !== AuthStatus.AUTHENTICATED ? (
        <AuthScreen />
      ) : phase === "queue" ? (
        <QueueScreen
          gameMode={selectedMode}
          onLeave={() => setPhase("lobby")}
        />
      ) : (
        <LobbyScreen
          onQueue={(mode) => {
            setSelectedMode(mode);
            setPhase("queue");
          }}
        />
      )}
    </GameStage>
  );
}
