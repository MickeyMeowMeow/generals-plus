import { create } from "zustand";

import type { AuthState, AuthStore } from "#/features/auth/auth-store";
import { AuthStatus } from "#/features/auth/auth-store";
import type { UserProfile } from "#/features/auth/user-profile";
import type { AuthData } from "#/infra/network/auth";
import type { NetworkProvider } from "#/infra/network/provider";
import { networkProvider } from "#/infra/network/provider";

/**
 * The baseline state applied on initialization or sign-out.
 */
const initialState: AuthState = {
  status: AuthStatus.IDLE,
  isHydrated: false,
  user: null,
  token: null,
  error: null,
};

/**
 * Safely extracts a human-readable message from an unknown thrown exception.
 *
 * @param error The caught exception.
 * @param fallback The default message to use if the error does not contain one.
 *
 * @returns A safe string for UI display.
 */
function normalizeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

/**
 * Factory function to instantiate the authentication store.
 *
 * @param provider The network provider used to execute auth requests.
 *
 * @returns A Zustand store hook bound to the provided network layer.
 */
export function createAuthStore(
  provider: NetworkProvider<UserProfile> = networkProvider,
) {
  return create<AuthStore>()((set, get) => {
    // Establish the real-time listener for server-pushed auth changes.
    provider.onAuthChange((response: AuthData<UserProfile>) => {
      set({
        status: response.user ? AuthStatus.AUTHENTICATED : AuthStatus.IDLE,
        isHydrated: true,
        user: response.user,
        token: response.token,
        error: null,
      });
    });

    // Used to deduplicate concurrent hydration attempts.
    let hydrationPromise: Promise<void> | null = null;

    return {
      ...initialState,

      async hydrate() {
        const { isHydrated, status } = get();

        // Bail out if we are already hydrated or currently processing an auth request.
        if (isHydrated || status === AuthStatus.AUTHENTICATING) return;

        // If a hydration is already in flight, wait for it rather than starting another.
        if (hydrationPromise) {
          await hydrationPromise;
          return;
        }

        set({ status: AuthStatus.HYDRATING, error: null });

        hydrationPromise = (async () => {
          try {
            const user = await provider.getUserData();
            set({
              status: AuthStatus.AUTHENTICATED,
              isHydrated: true,
              user,
              token: provider.getAuthToken(),
              error: null,
            });
          } catch {
            // A failure to hydrate simply means no active session exists.
            set({
              status: AuthStatus.IDLE,
              isHydrated: true,
              user: null,
              token: provider.getAuthToken(), // Token might exist but be expired/invalid
              error: null,
            });
          }
        })().finally(() => {
          hydrationPromise = null;
        });

        await hydrationPromise;
      },

      async signInAnonymously(displayName, metadata = {}) {
        const trimmedName = displayName.trim();
        if (trimmedName.length === 0) {
          set({
            status: AuthStatus.ERROR,
            error: "Display name cannot be empty.",
          });
          return;
        }

        set({ status: AuthStatus.AUTHENTICATING, error: null });

        try {
          const response = await provider.signInAnonymously({
            displayName: trimmedName,
            ...metadata,
          });

          set({
            status: AuthStatus.AUTHENTICATED,
            isHydrated: true,
            user: response.user,
            token: response.token ?? provider.getAuthToken(),
            error: null,
          });
        } catch (error) {
          set({
            status: AuthStatus.ERROR,
            error: normalizeError(error, "Failed to sign in anonymously."),
          });
        }
      },

      async signOut() {
        try {
          await provider.signOut();
          set({
            ...initialState,
            isHydrated: true, // We successfully detached; we are hydrated in an empty state
          });
        } catch (error) {
          set({
            status: AuthStatus.ERROR,
            error: normalizeError(error, "An error occurred during sign out."),
          });
        }
      },

      clearError() {
        set({ status: AuthStatus.IDLE, error: null });
      },
    };
  });
}

/**
 * The global authentication store hook used by React components.
 */
export const useAuthStore = createAuthStore();
