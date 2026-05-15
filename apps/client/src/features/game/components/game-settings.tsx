import { GameMode } from "@generals-plus/engine";
import type { SetupSettings } from "@generals-plus/shared-types";
import { Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";

interface GameSettingsProps {
  /** Whether the current player can edit setup-room settings. */
  isHost: boolean;
  /** Authoritative setup settings mirrored from the Colyseus room state. */
  currentSettings: SetupSettings;
  /** Sends a validated settings patch to the setup room. */
  onChangeSettings: (settings: Partial<SetupSettings>) => void;
}

/** Utility type to extract only the keys of SetupSettings that hold numeric values. */
type NumberKeys = {
  [K in keyof SetupSettings]: SetupSettings[K] extends number ? K : never;
}[keyof SetupSettings];

/**
 * Draft state permits numeric fields to hold intermediate string values.
 */
type DraftSettings = Omit<SetupSettings, NumberKeys> & {
  [K in NumberKeys]: number | string;
};

const NUMBER_FIELDS: Array<{ key: NumberKeys; label: string }> = [
  { key: "maxPlayers", label: "Max Players" },
  { key: "playersPerTeam", label: "Players Per Team" },
  { key: "mapWidth", label: "Map Width" },
  { key: "mapHeight", label: "Map Height" },
  { key: "seed", label: "Map Seed" },
  { key: "mountainRate", label: "Mountain Rate" },
  { key: "cityRate", label: "City Rate" },
  { key: "minGeneralDistanceFactor", label: "Min General Distance" },
  { key: "generalInitialTroops", label: "General Troops" },
  { key: "cityInitialTroops", label: "City Troops" },
];

/** Rounds a value to a consistent precision to avoid floating-point nonsense. */
const round = (v: number | string) => Math.round(Number(v) * 100000) / 100000;

/**
 * Host-editable setup settings panel.
 *
 * The host edits a local draft and submits one patch, while guests continue to
 * see the live room state. This avoids fighting Colyseus state updates while a
 * numeric field is mid-edit.
 */
export function GameSettings({
  isHost,
  currentSettings,
  onChangeSettings,
}: GameSettingsProps) {
  const [draft, setDraft] = useState<DraftSettings>(currentSettings);

  const isDirty =
    draft.gameMode !== currentSettings.gameMode ||
    draft.isPublic !== currentSettings.isPublic ||
    NUMBER_FIELDS.some(
      ({ key }) => round(draft[key]) !== round(currentSettings[key]),
    );

  // Sync draft with server settings only if the host hasn't made unsaved local changes.
  useEffect(() => {
    if (!isDirty) {
      setDraft(currentSettings);
    }
  }, [currentSettings, isDirty]);

  const handleNumberChange = (key: NumberKeys, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleModeChange = (mode: GameMode) => {
    setDraft((prev) => ({ ...prev, gameMode: mode }));
  };

  const handlePublicToggle = (checked: boolean) => {
    setDraft((prev) => ({ ...prev, isPublic: checked }));
  };

  const handleSave = () => {
    const payload: Partial<SetupSettings> = {
      gameMode: draft.gameMode,
      isPublic: draft.isPublic,
    };

    for (const { key } of NUMBER_FIELDS) {
      Object.assign(payload, { [key]: round(draft[key]) });
    }

    onChangeSettings(payload);
  };

  const handleDiscard = () => {
    setDraft(currentSettings);
  };

  // Guests see the live server state. The host sees their active draft.
  const displayed = isHost ? draft : currentSettings;
  const labelClassName = "text-sm text-game-text-dim";
  const fieldClassName = "grid gap-1.5";
  const inputClassName =
    "border-game-border bg-game-bg text-sm text-game-text focus-visible:ring-white/30 disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <section aria-labelledby="game-settings-title" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="game-settings-title" className="text-xl font-semibold">
          Game settings
        </h2>
        {!isHost ? (
          <span className="text-xs uppercase tracking-wide text-game-text-dim">
            read only
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
        <div className={fieldClassName}>
          <Label id="game-mode-label" className={labelClassName}>
            Game mode
          </Label>
          <Select
            disabled={!isHost}
            value={displayed.gameMode ?? GameMode.CLASSIC}
            onValueChange={(val) => {
              const mode = GAME_MODE_OPTIONS.find((o) => o.id === val)?.id;
              if (mode) handleModeChange(mode);
            }}
          >
            <SelectTrigger
              aria-labelledby="game-mode-label"
              size="sm"
              className="h-7 w-full border-game-border bg-game-bg px-3 text-sm text-game-text focus-visible:ring-white/30 disabled:opacity-60"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border border-game-border bg-game-surface text-game-text">
              {GAME_MODE_OPTIONS.map((mode) => (
                <SelectItem
                  key={mode.id}
                  value={mode.id}
                  disabled={!mode.isEnabled}
                >
                  {mode.label}
                  {mode.isEnabled ? "" : " (coming soon)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={fieldClassName}>
          <Label htmlFor="isPublic" className={labelClassName}>
            Visibility
          </Label>
          <div className="flex h-7 items-center justify-between border border-game-border bg-game-bg px-3 text-sm text-game-text dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40">
            <Label
              htmlFor="isPublic"
              className={
                isHost ? "cursor-pointer text-sm" : "cursor-not-allowed text-sm"
              }
            >
              {displayed.isPublic ? "Public" : "Private"}
            </Label>
            <Switch
              id="isPublic"
              size="sm"
              disabled={!isHost}
              checked={displayed.isPublic ?? false}
              onCheckedChange={handlePublicToggle}
            />
          </div>
        </div>

        {NUMBER_FIELDS.map(({ key, label }) => (
          <div key={key} className={fieldClassName}>
            <Label htmlFor={key} className={labelClassName}>
              {label}
            </Label>
            <Input
              id={key}
              type="number"
              disabled={!isHost}
              value={
                displayed[key] === Number(displayed[key])
                  ? round(displayed[key])
                  : displayed[key]
              }
              onChange={(e) => handleNumberChange(key, e.target.value)}
              className={inputClassName}
            />
          </div>
        ))}
      </div>

      {isHost && (
        <div className="flex justify-end gap-2 border-t border-game-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={!isDirty}
          >
            <RotateCcw className="size-3.5" />
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty}
          >
            <Check className="size-3.5" />
            Apply Changes
          </Button>
        </div>
      )}
    </section>
  );
}
