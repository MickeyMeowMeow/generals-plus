export const BACKGROUND_PRESETS = [
  { id: "default", label: "Default", url: "/bg.png" },
  { id: "touhou", label: "Touhou", url: "/bg-touhou.jpg" },
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

/** Account-level avatar preference. */
export type AvatarPreference =
  | {
      /** Uses the default initial-letter avatar. */
      readonly source: "default";
      /** Custom URLs are not valid for default avatars. */
      readonly customUrl?: never;
    }
  | {
      /** Uses a user-provided avatar image URL. */
      readonly source: "customUrl";
      /** User-provided image URL used when source is `customUrl`. */
      readonly customUrl: string;
    };

/** Controls for the stage center backdrop visual. */
export interface StageAppearancePreference {
  /** Whether the backdrop blur effect is enabled. */
  readonly backdropBlur: boolean;
  /** Backdrop overlay opacity 0–100. */
  readonly backdropOpacity: number;
}

/** Account-level user preferences shared across devices. */
export interface UserPreferences {
  /** Account-level background image configuration shared across devices. */
  readonly backgroundImage: BackgroundImagePreference;
  /** Account-level avatar configuration. */
  readonly avatar: AvatarPreference;
  /** Stage center backdrop visual controls. */
  readonly stageAppearance: StageAppearancePreference;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  backgroundImage: {
    source: "preset",
    presetId: "default",
  },
  avatar: {
    source: "default",
  },
  stageAppearance: {
    backdropBlur: true,
    backdropOpacity: 58,
  },
};
