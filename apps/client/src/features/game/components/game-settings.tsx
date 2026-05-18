import { GameMode } from "@generals-plus/engine";
import type {
  ClassicSetupSettings,
  DominationSetupSettings,
  SetupSettings,
  SetupState,
  TurfWarSetupSettings,
} from "@generals-plus/shared-types";
import { useState } from "react";

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
import { cn } from "#/lib/utils";

interface GameSettingsProps {
  /** Whether the current player can edit setup-room settings. */
  isHost: boolean;
  /** Authoritative setup settings mirrored from the Colyseus room state. */
  currentSettings: SetupState;
  /** Sends a validated settings patch to the setup room. */
  onChangeSettings: (settings: Partial<SetupSettings>) => void;
}

/** Utility type to extract only the keys that hold numeric values. */
type ExtractNumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

type NumberKeys =
  | ExtractNumberKeys<ClassicSetupSettings>
  | ExtractNumberKeys<TurfWarSetupSettings>
  | ExtractNumberKeys<DominationSetupSettings>;

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

/** Mode-specific numeric fields configuration. */
const MODE_SPECIFIC_FIELDS: Partial<
  Record<GameMode, Array<{ key: NumberKeys; label: string }>>
> = {
  [GameMode.TURF_WAR]: [{ key: "duration", label: "Duration (s)" }],
  [GameMode.DOMINATION]: [
    { key: "flagCount", label: "Flag Count" },
    { key: "targetScore", label: "Target Score" },
  ],
};

const GAME_SPEED_OPTIONS = [0.5, 1, 2, 4];

/** Rounds a value to a consistent precision to avoid floating-point nonsense. */
const round = (v: number | string) => Math.round(Number(v) * 100000) / 100000;

/**
 * Host-editable setup settings panel.
 *
 * Inputs are local-first while focused to prevent cursor jumping from network sync.
 * Changes are automatically submitted to the server when an input loses focus.
 */
export function GameSettings({
  isHost,
  currentSettings,
  onChangeSettings,
}: GameSettingsProps) {
  // Tracks the field currently being edited and its intermediate string value
  const [editing, setEditing] = useState<{
    key: NumberKeys;
    value: string;
  } | null>(null);

  const handleFocus = (key: NumberKeys, value: number) => {
    if (!isHost) return;
    setEditing({ key, value: String(round(value)) });
  };

  const handleSubmit = () => {
    if (!editing) return;
    const roundedValue = round(editing.value);
    // Only submit if the value actually differs from the authoritative server state
    if (roundedValue !== round(currentSettings[editing.key])) {
      onChangeSettings({ [editing.key]: roundedValue });
    }
    setEditing(null);
  };

  const handleNumberChange = (value: string) => {
    if (!editing) return;
    setEditing({ ...editing, value });
  };

  const labelClassName = "text-sm text-game-text-dim";
  const fieldClassName = "grid gap-1.5";
  const inputClassName =
    "border-game-border bg-game-bg text-sm text-game-text focus-visible:ring-white/30 disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  // Combine global number fields with those specific to the active game mode
  const activeNumberFields = [
    ...NUMBER_FIELDS,
    ...(MODE_SPECIFIC_FIELDS[currentSettings.gameMode] ?? []),
  ];

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
            value={currentSettings.gameMode ?? GameMode.CLASSIC}
            onValueChange={(val) => {
              const mode = GAME_MODE_OPTIONS.find((o) => o.id === val)?.id;
              if (mode) onChangeSettings({ gameMode: mode });
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
          <Label id="game-speed-label" className={labelClassName}>
            Game speed
          </Label>
          <Select
            disabled={!isHost}
            value={String(currentSettings.speed ?? 1)}
            onValueChange={(val) => onChangeSettings({ speed: Number(val) })}
          >
            <SelectTrigger
              aria-labelledby="game-speed-label"
              size="sm"
              className="h-7 w-full border-game-border bg-game-bg px-3 text-sm text-game-text focus-visible:ring-white/30 disabled:opacity-60"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border border-game-border bg-game-surface text-game-text">
              {GAME_SPEED_OPTIONS.map((speed) => (
                <SelectItem key={speed} value={String(speed)}>
                  {speed}x
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
              className={cn(
                "text-sm",
                isHost
                  ? "cursor-pointer"
                  : "cursor-not-allowed text-game-text-dim",
              )}
            >
              {currentSettings.isPublic ? "Public" : "Private"}
            </Label>
            <Switch
              id="isPublic"
              size="sm"
              disabled={!isHost}
              checked={currentSettings.isPublic ?? false}
              onCheckedChange={(checked) =>
                onChangeSettings({ isPublic: checked })
              }
            />
          </div>
        </div>

        {activeNumberFields.map(({ key, label }) => (
          <div key={key} className={fieldClassName}>
            <Label htmlFor={key} className={labelClassName}>
              {label}
            </Label>
            <Input
              id={key}
              type="number"
              disabled={!isHost}
              // Display local draft value if focused, otherwise display rounded server value
              value={
                editing?.key === key
                  ? editing.value
                  : round(currentSettings[key])
              }
              onFocus={() => handleFocus(key, currentSettings[key])}
              onBlur={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
              onChange={(e) => handleNumberChange(e.target.value)}
              className={inputClassName}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
