import type { UserPreferences } from "@generals-plus/shared-types";
import { BACKGROUND_PRESETS } from "@generals-plus/shared-types";

const DEFAULT_BACKGROUND_URL = "/bg.jpg";

/**
 * Resolves a saved user background preference into the image URL used by Stage.
 *
 * Preset preferences are looked up from the shared preset list. Unknown or
 * missing preset ids fall back to the deterministic default stage background.
 * Custom URL preferences return the saved URL as-is.
 *
 * @param preferences Optional saved user preferences from the active profile.
 * @returns The resolved background image URL, or `undefined` when no preference
 *   has been saved.
 */
export function resolveStageBackgroundUrl(
  preferences: UserPreferences | undefined,
): string | undefined {
  const backgroundImage = preferences?.backgroundImage;

  if (!backgroundImage) {
    return undefined;
  }

  if (backgroundImage.source === "customUrl") {
    return backgroundImage.customUrl;
  }

  return (
    BACKGROUND_PRESETS.find((preset) => preset.id === backgroundImage.presetId)
      ?.url ?? DEFAULT_BACKGROUND_URL
  );
}
