import { GameMode } from "@generals-plus/engine";
import type { SetupSettings } from "@generals-plus/shared-types";
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

interface GameSettingsProps {
  isHost: boolean;
  currentSettings: SetupSettings;
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

/** Formats enum strings like "TURF_WAR" into "Turf War". */
const formatMode = (mode: string): string =>
  mode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Displays and manages game configuration.
 * Host edits are buffered in a local draft state and explicitly submitted to prevent network sync conflicts.
 */
export function GameSettings({
  isHost,
  currentSettings,
  onChangeSettings,
}: GameSettingsProps) {
  const [draft, setDraft] = useState<DraftSettings>(currentSettings);
  const [isDirty, setIsDirty] = useState(false);

  // Sync draft with server settings only if the host hasn't made unsaved local changes.
  useEffect(() => {
    if (!isDirty) {
      setDraft(currentSettings);
    }
  }, [currentSettings, isDirty]);

  const handleNumberChange = (key: NumberKeys, value: string) => {
    setIsDirty(true);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleModeChange = (mode: GameMode) => {
    setIsDirty(true);
    setDraft((prev) => ({ ...prev, gameMode: mode }));
  };

  const handlePublicToggle = (checked: boolean) => {
    setIsDirty(true);
    setDraft((prev) => ({ ...prev, isPublic: checked }));
  };

  const handleSave = () => {
    const payload: Partial<SetupSettings> = {
      gameMode: draft.gameMode,
      isPublic: draft.isPublic,
    };

    for (const field of NUMBER_FIELDS) {
      const val = draft[field.key];
      payload[field.key] = typeof val === "string" ? parseFloat(val) || 0 : val;
    }

    onChangeSettings(payload);
    setIsDirty(false);
  };

  const handleDiscard = () => {
    setDraft(currentSettings);
    setIsDirty(false);
  };

  // Guests see the live server state. The host sees their active draft.
  const displayed = isHost ? draft : currentSettings;

  return (
    <div className="mb-6 w-full max-w-2xl rounded-xl border border-gray-800 bg-gray-900/50 p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between border-b border-gray-800 pb-3">
        <h2 className="text-xl font-semibold text-gray-200">Game Settings</h2>
        {!isHost && (
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Read Only
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 text-left">
        {/* Enum Field: Game Mode */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-400">Game Mode</Label>
          <Select
            disabled={!isHost}
            value={displayed.gameMode ?? GameMode.CLASSIC}
            onValueChange={(val) => handleModeChange(val as GameMode)}
          >
            <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              {Object.values(GameMode).map((mode) => (
                <SelectItem
                  key={mode}
                  value={mode}
                  className="focus:bg-gray-700 focus:text-white"
                >
                  {formatMode(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Boolean Field: Visibility */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-400">
            Visibility
          </Label>
          <div className="flex h-10 w-full items-center justify-between rounded-md border border-gray-700 bg-gray-800 px-3">
            <Label
              htmlFor="isPublic"
              className={`text-sm text-white ${isHost ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
            >
              {displayed.isPublic ? "Public" : "Private"}
            </Label>
            <Switch
              id="isPublic"
              disabled={!isHost}
              checked={displayed.isPublic ?? false}
              onCheckedChange={handlePublicToggle}
            />
          </div>
        </div>

        {/* Numeric Fields */}
        {NUMBER_FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={key} className="text-xs font-medium text-gray-400">
              {label}
            </Label>
            <Input
              id={key}
              type="number"
              disabled={!isHost}
              value={displayed[key] ?? ""}
              onChange={(e) => handleNumberChange(key, e.target.value)}
              className="w-full bg-gray-800 border-gray-700 text-white disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        ))}
      </div>

      {/* Host Action Buttons */}
      {isHost && (
        <div className="mt-8 flex justify-end gap-3 border-t border-gray-800 pt-4">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={!isDirty}
            className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Discard
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            Apply Changes
          </Button>
        </div>
      )}
    </div>
  );
}
