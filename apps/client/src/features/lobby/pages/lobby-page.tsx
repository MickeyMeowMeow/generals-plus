import type { GameMode } from "@generals-plus/engine";
import {
  CUSTOM_ROOM_KEY_MAX_LENGTH,
  CUSTOM_ROOM_KEY_MIN_LENGTH,
  isValidCustomRoomKeyLength,
} from "@generals-plus/shared-types";
import { LogOut, Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { BrandTitle, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useAuth, useUser } from "#/features/auth/hooks";
import { networkProvider } from "#/infra/network/provider";
import { HttpRequestError } from "#/infra/network/provider/colyseus";

type ModeOption = (typeof GAME_MODE_OPTIONS)[number];
const CUSTOM_ROOM_KEY_LENGTH_ERROR = `Room id must be ${CUSTOM_ROOM_KEY_MIN_LENGTH} - ${CUSTOM_ROOM_KEY_MAX_LENGTH} characters.`;

function ModeCard({
  mode,
  onSelect,
}: {
  mode: ModeOption;
  onSelect: (mode: GameMode) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={!mode.isEnabled}
      onClick={() => onSelect(mode.id)}
      aria-label={`${mode.label}, ${mode.isEnabled ? "Ready" : "Coming soon"}`}
      className="h-24 w-full flex-col items-start justify-between whitespace-normal border-game-border bg-game-bg p-3 text-left text-game-text hover:border-white/50 hover:bg-game-surface focus-visible:ring-white/30 disabled:opacity-45"
    >
      <span className="text-lg font-semibold leading-tight">{mode.label}</span>
      <span className="text-xs text-game-text-dim">
        {mode.isEnabled ? "Ready" : "Coming soon"}
      </span>
    </Button>
  );
}

function ModePickerDialog({
  open,
  onClose,
  onSelectMode,
}: {
  open: boolean;
  onClose: () => void;
  onSelectMode: (mode: GameMode) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="max-h-[min(48rem,calc(100svh-2rem))] sm:max-w-4xl overflow-auto border-game-border bg-game-surface p-5 text-game-text"
        aria-describedby={undefined}
        showCloseButton={true}
      >
        <DialogHeader className="flex-row items-center justify-between gap-3">
          <DialogTitle className="text-xl">Choose mode</DialogTitle>
        </DialogHeader>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_MODE_OPTIONS.map((mode) => (
            <ModeCard key={mode.id} mode={mode} onSelect={onSelectMode} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Authenticated official lobby scene.
 *
 * The lobby keeps the root route stable, offers a mode picker before official
 * queueing, and creates private custom setup rooms by URL.
 */
export function LobbyPage({
  onQueue,
  onVsAi,
}: {
  onQueue: (mode: GameMode) => void;
  onVsAi: () => void;
}) {
  const navigate = useNavigate();
  const { actions } = useAuth();
  const displayName = useUser((user) => user?.displayName ?? "Commander");
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customRoomId, setCustomRoomId] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);

  const [aiStatus, setAiStatus] = useState<"loading" | "online" | "offline">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    networkProvider
      .checkAiHealth()
      .then((available) => {
        if (!cancelled) setAiStatus(available ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setAiStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createOrJoinCustomRoom = async () => {
    const trimmedRoomId = customRoomId.trim();
    if (trimmedRoomId && !isValidCustomRoomKeyLength(trimmedRoomId)) {
      setCustomError(CUSTOM_ROOM_KEY_LENGTH_ERROR);
      return;
    }
    setIsCreatingCustom(true);
    setCustomError(null);
    try {
      const room = await networkProvider.createCustomRoom(trimmedRoomId);
      navigate(`/match/${encodeURIComponent(room.customRoomKey)}`);
    } catch (error) {
      if (
        trimmedRoomId &&
        error instanceof HttpRequestError &&
        error.status === 409
      ) {
        navigate(`/match/${encodeURIComponent(trimmedRoomId)}`);
        return;
      }
      setCustomError(
        error instanceof Error ? error.message : "Failed to create custom room",
      );
    } finally {
      setIsCreatingCustom(false);
    }
  };

  const signOut = async () => {
    await actions.signOut();
  };

  return (
    <>
      {isModePickerOpen ? (
        <ModePickerDialog
          open={isModePickerOpen}
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

          <section className="grid min-h-40 place-items-center gap-3 border-t border-game-border pt-5 sm:min-h-44">
            <Button
              type="button"
              size="lg"
              onClick={() => setIsModePickerOpen(true)}
              className="min-w-36"
            >
              <Play className="size-4" />
              Start
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={aiStatus !== "online"}
              onClick={onVsAi}
              className="min-w-36 border-game-border text-game-text hover:border-white/50 hover:bg-game-surface disabled:opacity-45"
            >
              {aiStatus === "loading"
                ? "Checking AI..."
                : aiStatus === "offline"
                  ? "AI Offline"
                  : "VS AI"}
            </Button>
          </section>

          <section className="grid min-h-32 place-items-center border-t border-game-border pt-5 sm:min-h-36">
            <div className="grid w-full justify-items-stretch gap-3">
              <div className="mx-auto flex w-full max-w-sm flex-col gap-3 sm:flex-row">
                <Input
                  value={customRoomId}
                  onChange={(event) => {
                    setCustomRoomId(event.target.value);
                    if (customError) {
                      setCustomError(null);
                    }
                  }}
                  placeholder="Leave blank to randomize"
                  aria-label="Custom room id"
                  autoComplete="off"
                  className="flex-1 border-game-border bg-game-bg text-game-text placeholder:text-game-text-dim"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isCreatingCustom) {
                      event.preventDefault();
                      void createOrJoinCustomRoom();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => void createOrJoinCustomRoom()}
                  disabled={isCreatingCustom}
                  className="min-w-48 justify-center"
                >
                  <Plus className="size-4" />
                  {isCreatingCustom ? "Creating..." : "Create/Join custom room"}
                </Button>
              </div>

              {customError ? (
                <p className="mx-auto flex min-h-8 w-full max-w-sm items-center rounded-none border border-destructive/40 px-3 text-sm text-destructive">
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
