import type { UserPreferences } from "@generals-plus/shared-types";

/**
 * Resolves the user's avatar image URL from preferences.
 *
 * Returns the custom URL when configured, or `null` when the user
 * has the default (initial-letter) avatar.
 */
export function resolveAvatarUrl(
  preferences: UserPreferences | undefined,
): string | null {
  if (preferences?.avatar?.source === "customUrl") {
    return preferences.avatar.customUrl;
  }
  return null;
}

/**
 * Extracts the first character of a display name for the default
 * initial-letter avatar fallback.
 */
export function getInitial(name: string | undefined | null): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}
