import type { UserProfile } from "#/common/types/user-profile";
import { useAuth } from "#/features/auth/hooks/use-auth";

/**
 * A convenience hook that returns the currently authenticated user's profile
 * (or `null` if unauthenticated), optionally transformed by a selector.
 *
 * This is a shorthand for `useAuth().state.user` with optional selection.
 *
 * @template T The type of the value returned by the selector.
 *
 * @param selector An optional function that maps the `UserProfile` (or `null`)
 *   to a specific value. If omitted, the full `UserProfile | null` is returned.
 *
 * @returns The value produced by the selector, or the full user profile.
 *
 * @throws {Error} If called outside of an `<AuthProvider>`.
 *
 * @example
 * ```tsx
 * // Get the full user profile
 * const user = useUser();
 *
 * // Get just the display name
 * const displayName = useUser((u) => u?.displayName ?? "Guest");
 * ```
 */
export function useUser(): UserProfile | null;
export function useUser<T>(selector: (user: UserProfile | null) => T): T;
export function useUser<T>(
  selector?: (user: UserProfile | null) => T,
): T | UserProfile | null {
  const { state } = useAuth();
  const user = state.user;
  return selector ? selector(user) : user;
}
