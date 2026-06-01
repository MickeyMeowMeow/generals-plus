import type {
  AvatarPreference,
  BackgroundImagePreference,
  BackgroundPresetId,
  UserPreferences,
} from "@generals-plus/shared-types";
import {
  BACKGROUND_PRESETS,
  DEFAULT_USER_PREFERENCES,
} from "@generals-plus/shared-types";
import { ArrowLeft, Pencil, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Slider } from "#/components/ui/slider";
import { Switch } from "#/components/ui/switch";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useAuth, useUser } from "#/features/auth/hooks";
import { MotionStaggerGroup } from "#/features/motion/components/motion-stagger";
import { Avatar } from "#/features/profile/components/avatar";
import { cn } from "#/lib/utils";

type BackgroundValue = BackgroundPresetId | "customUrl";

export function ProfilePage() {
  const user = useUser();
  const { actions } = useAuth();

  useEffect(() => {
    void actions.refreshUser();
  }, [actions]);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [isEditingName, setIsEditingName] = useState(false);
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
  const [avatar, setAvatar] = useState<AvatarPreference>(
    user?.preferences?.avatar ?? DEFAULT_USER_PREFERENCES.avatar,
  );
  const [avatarCustomUrl, setAvatarCustomUrl] = useState(
    user?.preferences?.avatar?.source === "customUrl"
      ? user.preferences.avatar.customUrl
      : "",
  );
  const [motionMode, setMotionMode] = useState<
    UserPreferences["motion"]["mode"]
  >(user?.preferences?.motion?.mode ?? DEFAULT_USER_PREFERENCES.motion.mode);
  const [backdropBlur, setBackdropBlur] = useState(
    user?.preferences?.stageAppearance?.backdropBlur ??
      DEFAULT_USER_PREFERENCES.stageAppearance.backdropBlur,
  );
  const [backdropOpacity, setBackdropOpacity] = useState(
    user?.preferences?.stageAppearance?.backdropOpacity ??
      DEFAULT_USER_PREFERENCES.stageAppearance.backdropOpacity,
  );
  const [isSaving, setIsSaving] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleNameSave = useCallback(async () => {
    setIsEditingName(false);
    const trimmed = displayName.trim();

    if (trimmed.length === 0) {
      toast.error("Display name cannot be empty.", { duration: 5_000 });
      setDisplayName(user?.displayName ?? "");
      return;
    }

    if (trimmed === user?.displayName) return;

    setIsSaving(true);
    try {
      await actions.updateUserProfile({ displayName: trimmed });
      toast.success("Display name updated.");
    } catch {
      toast.error("Failed to update display name.", { duration: 5_000 });
      setDisplayName(user?.displayName ?? "");
    } finally {
      setIsSaving(false);
    }
  }, [actions, displayName, user]);

  if (!user) {
    return null;
  }

  const selectedBackground: BackgroundValue =
    backgroundImage.source === "preset"
      ? backgroundImage.presetId
      : "customUrl";

  const handlePreferencesSave = async () => {
    const preferences: UserPreferences = {
      backgroundImage:
        backgroundImage.source === "customUrl"
          ? { source: "customUrl", customUrl: customUrl.trim() }
          : backgroundImage,
      avatar:
        avatar.source === "customUrl"
          ? { source: "customUrl", customUrl: avatarCustomUrl.trim() }
          : avatar,
      motion: { mode: motionMode },
      stageAppearance: {
        backdropBlur,
        backdropOpacity,
      },
    };

    setIsSaving(true);
    try {
      await actions.updateUserProfile({ preferences });
      toast.success("Preferences saved.");
    } catch (saveError) {
      toast.error("Failed to save preferences.", {
        description:
          saveError instanceof Error && saveError.message.trim().length > 0
            ? saveError.message
            : "",
        duration: 5_000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StageCenter>
      <MotionStaggerGroup className="mx-auto grid w-full max-w-3xl gap-5">
        {/* Header with inline-editable display name */}
        <div className="flex items-center justify-between">
          <div className="group/name relative">
            {isEditingName ? (
              <Input
                ref={nameInputRef}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => void handleNameSave()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") nameInputRef.current?.blur();
                  if (e.key === "Escape") {
                    setDisplayName(user.displayName ?? "");
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className="h-9 w-56 rounded-none text-2xl! font-bold"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-none px-1 -mx-1 transition-colors hover:bg-white/5"
              >
                <h1 className="text-3xl font-bold leading-tight">
                  {user.displayName}
                </h1>
                <Pencil className="size-4 text-game-text-dim" />
              </button>
            )}
          </div>
          <Button asChild variant="ghost" className="w-fit">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Lobby
            </Link>
          </Button>
        </div>

        {user.ratings ? (
          <section className="grid gap-3 border-t border-game-border pt-5">
            <h2 className="text-base font-semibold">Ratings</h2>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {GAME_MODE_OPTIONS.filter((m) => !m.isVsAi)
                .filter((mode) => user.ratings?.[mode.id] !== undefined)
                .map((mode) => (
                  <div
                    key={mode.id}
                    className="flex min-h-10 items-center justify-between gap-4 border border-game-border bg-transparent px-3 py-2"
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

        {/* Avatar */}
        <section className="grid gap-3 border-t border-game-border pt-5">
          <h2 className="text-base font-semibold">Avatar</h2>
          <div className="flex items-start gap-4">
            <Avatar preferences={avatar} size="lg" />
            <div className="flex-1 grid gap-2">
              <RadioGroup
                value={avatar.source}
                onValueChange={(value: string) => {
                  if (value === "default") {
                    setAvatar({ source: "default" });
                  } else {
                    setAvatar({
                      source: "customUrl",
                      customUrl: avatarCustomUrl.trim(),
                    });
                  }
                }}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-transparent px-3 py-2 text-sm",
                    avatar.source === "default" && "border-white/60 bg-white/5",
                  )}
                >
                  <RadioGroupItem value="default" />
                  Default
                </Label>
                <Label
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-transparent px-3 py-2 text-sm",
                    avatar.source === "customUrl" &&
                      "border-white/60 bg-white/5",
                  )}
                >
                  <RadioGroupItem value="customUrl" />
                  Custom URL
                </Label>
              </RadioGroup>
              {avatar.source === "customUrl" && (
                <Input
                  value={avatarCustomUrl}
                  onChange={(e) => {
                    setAvatarCustomUrl(e.target.value);
                    setAvatar({
                      source: "customUrl",
                      customUrl: e.target.value.trim(),
                    });
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  className="border-game-border bg-game-bg text-game-text placeholder:text-game-text-dim"
                />
              )}
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="grid gap-4 border-t border-game-border pt-5">
          <h2 className="text-base font-semibold">Appearance</h2>

          <div className="grid gap-2">
            <Label>Background</Label>
            <RadioGroup
              value={selectedBackground}
              onValueChange={(value: string) => {
                if (value === "customUrl") {
                  setBackgroundImage({
                    source: "customUrl",
                    customUrl: customUrl.trim(),
                  });
                } else {
                  setBackgroundImage({
                    source: "preset",
                    presetId: value as BackgroundPresetId,
                  });
                }
              }}
              className="grid gap-2 sm:grid-cols-3"
            >
              {BACKGROUND_PRESETS.map((preset) => (
                <Label
                  key={preset.id}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-transparent px-3 py-2 text-sm",
                    selectedBackground === preset.id &&
                      "border-white/60 bg-white/5",
                  )}
                >
                  <RadioGroupItem value={preset.id} />
                  {preset.label}
                </Label>
              ))}
              <Label
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-transparent px-3 py-2 text-sm",
                  selectedBackground === "customUrl" &&
                    "border-white/60 bg-white/5",
                )}
              >
                <RadioGroupItem value="customUrl" />
                Custom URL
              </Label>
            </RadioGroup>

            {selectedBackground === "customUrl" && (
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
            )}
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="backdrop-blur">Blur</Label>
              <div className="ml-auto">
                <Switch
                  id="backdrop-blur"
                  checked={backdropBlur}
                  onCheckedChange={setBackdropBlur}
                />
              </div>
            </div>
            <div className="col-span-3 flex items-center gap-3">
              <Label>Opacity</Label>
              <Slider
                value={[backdropOpacity]}
                onValueChange={([value]) => setBackdropOpacity(value)}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="w-8 text-right text-sm text-game-text-dim">
                {backdropOpacity}%
              </span>
            </div>
          </div>

          <Label>Motion</Label>
          <RadioGroup
            value={motionMode}
            onValueChange={(value) => setMotionMode(value as typeof motionMode)}
            className="grid gap-2 sm:grid-cols-3"
          >
            <Label
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-transparent px-3 py-2 text-sm",
                motionMode === "system" && "border-white/60 bg-white/5",
              )}
            >
              <RadioGroupItem value="system" />
              Follow system
            </Label>
            <Label
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-transparent px-3 py-2 text-sm",
                motionMode === "full" && "border-white/60 bg-white/5",
              )}
            >
              <RadioGroupItem value="full" />
              Full motion
            </Label>
            <Label
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 border border-game-border bg-transparent px-3 py-2 text-sm",
                motionMode === "reduced" && "border-white/60 bg-white/5",
              )}
            >
              <RadioGroupItem value="reduced" />
              Reduced motion
            </Label>
          </RadioGroup>
        </section>

        {/* Save */}
        <div className="flex justify-end border-t border-game-border pt-5">
          <Button
            type="button"
            onClick={() => void handlePreferencesSave()}
            disabled={isSaving}
          >
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </MotionStaggerGroup>
    </StageCenter>
  );
}
