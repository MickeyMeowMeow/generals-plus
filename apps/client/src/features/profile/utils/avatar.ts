import type { AvatarPreference } from "@generals-plus/shared-types";

/**
 * Resolves the user's avatar image URL from preferences.
 *
 * Returns the custom URL when configured, or `null` when the user
 * has the default avatar (rendered as a User icon).
 */
export function resolveAvatarUrl(
  preferences: AvatarPreference | undefined,
): string | null {
  if (preferences?.source === "customUrl") {
    return preferences.customUrl;
  }
  return null;
}
