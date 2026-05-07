import { useAuthStore } from "#/features/auth/hooks/use-auth-store";
import type { UserProfile } from "#/features/auth/user-profile";

/**
 * A specialized hook to access the currently authenticated user's profile.
 *
 * @template T The type of the value returned by the selector.
 *
 * @param selector A function that maps the UserProfile (or null) to a specific value. If omitted, the entire UserProfile object is returned.
 *
 * @returns The value produced by the selector, or the full UserProfile.
 */
export function useUser(): UserProfile | null;
export function useUser<T>(selector: (user: UserProfile | null) => T): T;
export function useUser<T>(
  selector?: (user: UserProfile | null) => T,
): T | UserProfile | null {
  return useAuthStore((state) => {
    const user = state.user;
    return selector ? selector(user) : user;
  });
}
