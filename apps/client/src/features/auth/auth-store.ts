import type { UserProfile } from "#/common/types/user-profile";

/**
 * Defines the possible lifecycle states of the user's authentication session.
 */
export const AuthStatus = {
  /** The user is not authenticated and no active process is running. */
  IDLE: "idle",
  /** The application is actively checking the server for an existing session. */
  HYDRATING: "hydrating",
  /** The user is actively attempting to log in. */
  AUTHENTICATING: "authenticating",
  /** The user is successfully authenticated and session data is available. */
  AUTHENTICATED: "authenticated",
  /** A terminal error occurred during authentication or hydration. */
  ERROR: "error",
} as const;

/**
 * Union type derived from the AuthStatus constants.
 */
export type AuthStatus = (typeof AuthStatus)[keyof typeof AuthStatus];

/**
 * Represents the reactive state of the authentication slice.
 */
export interface AuthState {
  /** The current status of the authentication state machine. */
  readonly status: AuthStatus;
  /** True if the application has completed its initial session check with the server. */
  readonly isHydrated: boolean;
  /** The profile data of the currently authenticated user, or null if unauthenticated. */
  readonly user: UserProfile | null;
  /** The raw network token used for room connections, or null if unauthenticated. */
  readonly token: string | null;
  /** A human-readable error message if the status is ERROR, otherwise null. */
  readonly error: string | null;
}

/**
 * Represents the operations available to mutate the authentication state.
 */
export interface AuthActions {
  /**
   * Attempts to restore an existing session from the server.
   * Deduplicates concurrent calls to prevent redundant network requests.
   */
  hydrate(): Promise<void>;

  /**
   * Authenticates the user as a guest using a provided display name.
   *
   * @param displayName The visible name chosen by the user.
   * @param metadata Optional extra tracking data for the guest profile.
   */
  signInAnonymously(
    displayName: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Terminates the current session locally and on the server.
   */
  signOut(): Promise<void>;

  /**
   * Manually clears the active error state, returning the status to IDLE.
   */
  clearError(): void;
}

/**
 * The complete Zustand store type combining state and actions.
 */
export type AuthStore = AuthState & AuthActions;
