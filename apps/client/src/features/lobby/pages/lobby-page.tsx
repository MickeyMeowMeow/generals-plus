import type { GameMode } from "@generals-plus/engine";
import {
  CUSTOM_ROOM_KEY_MAX_LENGTH,
  CUSTOM_ROOM_KEY_MIN_LENGTH,
  isValidCustomRoomKeyLength,
} from "@generals-plus/shared-types";
import { LogOut, Map as MapIcon, Play, Plus, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

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
import { Avatar } from "#/features/profile/components/avatar";
import { ModeHelpButton } from "#/features/staging/components/mode-help-button";
import { networkProvider } from "#/infra/network/provider";
import { HttpRequestError } from "#/infra/network/provider/colyseus";

type ModeOption = (typeof GAME_MODE_OPTIONS)[number];
const CUSTOM_ROOM_KEY_LENGTH_ERROR = `Room id must be ${CUSTOM_ROOM_KEY_MIN_LENGTH} - ${CUSTOM_ROOM_KEY_MAX_LENGTH} characters.`;

function ModeCard({
  mode,
  aiStatus: _aiStatus,
  onSelect,
  onVsAi,
}: {
  mode: ModeOption;
  aiStatus?: "loading" | "online" | "offline";
  onSelect: (mode: GameMode) => void;
  onVsAi?: () => void;
}) {
  const isVsAi = mode.isVsAi;
  const isDisabled = isVsAi ? _aiStatus !== "online" : !mode.isEnabled;

  const statusLabel = isVsAi
    ? _aiStatus === "loading"
      ? "Checking AI..."
      : _aiStatus === "online"
        ? "Ready"
        : "AI Service Temporarily Unavailable"
    : mode.isEnabled
      ? "Ready"
      : "Coming soon";

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        disabled={isDisabled}
        onClick={() => (isVsAi ? onVsAi?.() : onSelect(mode.id as GameMode))}
        aria-label={`${mode.label}, ${statusLabel}`}
        className="h-24 w-full flex-col items-start justify-between whitespace-normal border-game-border bg-game-bg p-3 text-left text-game-text hover:border-white/50 hover:bg-game-surface focus-visible:ring-white/30 disabled:opacity-45"
      >
        <span className="text-lg font-semibold leading-tight">
          {mode.label}
        </span>
        <span className="text-xs text-game-text-dim">{statusLabel}</span>
      </Button>

      <ModeHelpButton
        gameMode={mode.id}
        className="absolute top-1.5 right-1.5 text-game-text-dim hover:text-game-text"
      />
    </div>
  );
}

function ModePickerDialog({
  open,
  aiStatus,
  onClose,
  onSelectMode,
  onVsAi,
}: {
  open: boolean;
  aiStatus: "loading" | "online" | "offline";
  onClose: () => void;
  onSelectMode: (mode: GameMode) => void;
  onVsAi: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="max-h-[min(48rem,calc(100svh-2rem))] sm:max-w-4xl overflow-auto p-5"
        aria-describedby={undefined}
        showCloseButton={true}
      >
        <DialogHeader className="flex-row items-center justify-between gap-3">
          <DialogTitle className="text-xl">Choose mode</DialogTitle>
        </DialogHeader>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_MODE_OPTIONS.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              aiStatus={mode.isVsAi ? aiStatus : undefined}
              onSelect={onSelectMode}
              onVsAi={mode.isVsAi ? onVsAi : undefined}
            />
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
  const preferences = useUser((user) => user?.preferences);
  const isAdmin = useUser((user) => user?.isAdmin ?? false);
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
          aiStatus={aiStatus}
          onClose={() => setIsModePickerOpen(false)}
          onSelectMode={(mode) => {
            setIsModePickerOpen(false);
            onQueue(mode);
          }}
          onVsAi={() => {
            setIsModePickerOpen(false);
            onVsAi();
          }}
        />
      ) : null}

      <StageCenter>
        <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
          <BrandTitle compact />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar preferences={preferences?.avatar} />
              <div>
                <p className="text-sm text-game-text-dim">Hello,</p>
                <p className="text-2xl font-bold">{displayName}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isAdmin && (
                <Button asChild variant="ghost">
                  <Link to="/admin">
                    <Shield className="size-4" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost">
                <Link to="/maps">
                  <MapIcon className="size-4" />
                  Maps
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/profile">
                  <User className="size-4" />
                  Profile
                </Link>
              </Button>
              <Button type="button" variant="ghost" onClick={signOut}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
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
