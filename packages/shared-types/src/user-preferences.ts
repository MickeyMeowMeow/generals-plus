export const BACKGROUND_PRESETS = [
  { id: "classic", label: "Classic", url: "/bg.jpg" },
  { id: "dark-grid", label: "Dark Grid", url: "/bg.jpg" },
  { id: "frontier", label: "Frontier", url: "/bg.jpg" },
] as const;

export type BackgroundPresetId = (typeof BACKGROUND_PRESETS)[number]["id"];

/** Account-level stage background image preference. */
export type BackgroundImagePreference =
  | {
      /** Selects a built-in background preset. */
      readonly source: "preset";
      /** Built-in background id used when source is `preset`. */
      readonly presetId: BackgroundPresetId;
      /** Custom URLs are not valid for preset backgrounds. */
      readonly customUrl?: never;
    }
  | {
      /** Selects a user-provided background image URL. */
      readonly source: "customUrl";
      /** User-provided image URL used when source is `customUrl`. */
      readonly customUrl: string;
      /** Preset ids are not valid for custom URL backgrounds. */
      readonly presetId?: never;
    };

/** Account-level user preferences shared across devices. */
export interface UserPreferences {
  /** Account-level background image configuration shared across devices. */
  readonly backgroundImage: BackgroundImagePreference;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  backgroundImage: {
    source: "preset",
    presetId: "classic",
  },
};
