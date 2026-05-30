import type {
  BackgroundImagePreference,
  UserPreferences,
} from "@generals-plus/shared-types";
import {
  BACKGROUND_PRESETS,
  DEFAULT_USER_PREFERENCES,
} from "@generals-plus/shared-types";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useAuth, useUser } from "#/features/auth/hooks";
import { cn } from "#/lib/utils";

const CUSTOM_BACKGROUND_VALUE = "customUrl";

export function ProfilePage() {
  const user = useUser();
  const { actions } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [backgroundImage, setBackgroundImage] =
    useState<BackgroundImagePreference>(
      user?.preferences?.backgroundImage ??
        DEFAULT_USER_PREFERENCES.backgroundImage,
    );
  const [customUrl, setCustomUrl] = useState(
    user?.preferences?.backgroundImage.source === "customUrl"
      ? user.preferences.backgroundImage.customUrl
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!user) {
    return null;
  }

  const selectedBackground =
    backgroundImage.source === "preset"
      ? backgroundImage.presetId
      : CUSTOM_BACKGROUND_VALUE;

  const saveProfile = async () => {
    const trimmedDisplayName = displayName.trim();

    if (trimmedDisplayName.length === 0) {
      setError("Display name cannot be empty.");
      return;
    }

    const preferences: UserPreferences = {
      backgroundImage:
        backgroundImage.source === "customUrl"
          ? { source: "customUrl", customUrl: customUrl.trim() }
          : backgroundImage,
    };

    setIsSaving(true);
    setError(null);

    try {
      await actions.updateUserProfile({
        displayName: trimmedDisplayName,
        preferences,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message.trim().length > 0
          ? saveError.message
          : "Failed to save profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StageCenter>
      <div className="mx-auto grid w-full max-w-3xl gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight">Profile</h1>
            <p className="mt-1 text-sm text-game-text-dim">
              Account settings for {user.displayName}
            </p>
          </div>
          <Button asChild variant="ghost" className="w-fit">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Lobby
            </Link>
          </Button>
        </div>

        <section className="grid gap-4 border-t border-game-border pt-5">
          <div className="grid gap-2 sm:max-w-sm">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              className="border-game-border bg-game-bg text-game-text"
            />
          </div>
        </section>

        {user.ratings ? (
          <section className="grid gap-3 border-t border-game-border pt-5">
            <h2 className="text-base font-semibold">Ratings</h2>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {GAME_MODE_OPTIONS.filter(
                (mode) => user.ratings?.[mode.id] !== undefined,
              ).map((mode) => (
                <div
                  key={mode.id}
                  className="flex min-h-10 items-center justify-between gap-4 border border-game-border bg-game-bg px-3 py-2"
                >
                  <dt className="text-sm text-game-text-dim">{mode.label}</dt>
                  <dd className="text-sm font-semibold">
                    {user.ratings?.[mode.id]}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section className="grid gap-3 border-t border-game-border pt-5">
          <h2 className="text-base font-semibold">Background</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {BACKGROUND_PRESETS.map((preset) => (
              <label
                key={preset.id}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-game-bg px-3 py-2 text-sm",
                  selectedBackground === preset.id &&
                    "border-white/60 bg-game-surface",
                )}
              >
                <input
                  type="radio"
                  name="background"
                  value={preset.id}
                  checked={selectedBackground === preset.id}
                  onChange={() =>
                    setBackgroundImage({
                      source: "preset",
                      presetId: preset.id,
                    })
                  }
                  className="size-3 accent-current"
                />
                {preset.label}
              </label>
            ))}
            <label
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-game-bg px-3 py-2 text-sm",
                selectedBackground === CUSTOM_BACKGROUND_VALUE &&
                  "border-white/60 bg-game-surface",
              )}
            >
              <input
                type="radio"
                name="background"
                value={CUSTOM_BACKGROUND_VALUE}
                checked={selectedBackground === CUSTOM_BACKGROUND_VALUE}
                onChange={() =>
                  setBackgroundImage({
                    source: "customUrl",
                    customUrl: customUrl.trim(),
                  })
                }
                className="size-3 accent-current"
              />
              Custom image URL
            </label>
          </div>

          <div className="grid gap-2 sm:max-w-xl">
            <Label htmlFor="custom-background-url">Custom image URL</Label>
            <Input
              id="custom-background-url"
              value={customUrl}
              onChange={(event) => {
                const nextUrl = event.target.value;
                setCustomUrl(nextUrl);
                if (backgroundImage.source === "customUrl") {
                  setBackgroundImage({
                    source: "customUrl",
                    customUrl: nextUrl.trim(),
                  });
                }
              }}
              placeholder="https://example.com/background.jpg"
              className="border-game-border bg-game-bg text-game-text placeholder:text-game-text-dim"
            />
          </div>
        </section>

        {error ? (
          <p className="border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-game-border pt-5">
          <Button
            type="button"
            onClick={() => void saveProfile()}
            disabled={isSaving}
          >
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </div>
    </StageCenter>
  );
}
