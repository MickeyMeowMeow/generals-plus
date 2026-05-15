import type { GameMode } from "@generals-plus/engine";
import { LogOut, Play, Plus, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { BrandTitle, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useAuth, useUser } from "#/features/auth/hooks";
import { clearPersistedGameSession } from "#/features/game/api/use-game-room";
import { createCustomSetupRoom } from "#/features/game/api/use-setup-room";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

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
        className="game-panel max-h-[min(42rem,calc(100svh-2rem))] w-full max-w-3xl overflow-auto rounded-none p-5"
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
              className="rounded-none border border-game-border bg-game-bg p-4 text-left transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="block text-base font-semibold">
                {mode.label}
              </span>
              <span className="mt-2 block text-sm leading-5 text-game-text-dim">
                {mode.isEnabled ? "Ready to play" : "Coming soon"}
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
export function LobbyPage({ onQueue }: { onQueue: (mode: GameMode) => void }) {
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

  /**
   * Sign-out clears both the legacy match connection store and the newer
   * GamePage recovery token so a future login never restores someone else's
   * stale match session.
   */
  const signOut = async () => {
    await resetMatchConnection();
    clearPersistedGameSession();
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
        <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
          <BrandTitle compact />

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-game-text-dim">Hello,</p>
              <p className="text-2xl font-bold">{displayName}</p>
            </div>
            <Button type="button" variant="ghost" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>

          <section className="grid min-h-40 place-items-center border-t border-game-border pt-5 sm:min-h-44">
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

          <section className="grid min-h-32 place-items-center border-t border-game-border pt-5 sm:min-h-36">
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
                <p className="rounded-none border border-destructive/40 p-3 text-sm text-destructive">
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
