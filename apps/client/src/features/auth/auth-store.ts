import type { UserProfile } from "#/common/types/user-profile";

export interface RegisterWithEmailInput {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
}

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
 * Represents the operations available to trigger authentication state transitions.
 */
export interface AuthActions {
  /**
   * Attempts to restore an existing session from the server.
   * Deduplicates concurrent calls to prevent redundant network requests.
   */
  hydrate(): Promise<void>;

  /**
   * Authenticates the user with an email address and password.
   */
  signInWithEmailAndPassword(email: string, password: string): Promise<void>;

  /**
   * Registers a user with display name, email address, and password.
   */
  registerWithEmailAndPassword(input: RegisterWithEmailInput): Promise<void>;

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
   * Saves profile changes and updates the local authenticated user snapshot.
   */
  updateUserProfile(update: Partial<UserProfile>): Promise<void>;

  /**
   * Manually clears the active error state, returning the status to IDLE.
   */
  clearError(): void;
}

/**
 * The baseline state applied on initialization or sign-out.
 */
export const initialAuthState: AuthState = {
  status: AuthStatus.IDLE,
  isHydrated: false,
  user: null,
  token: null,
  error: null,
};

/**
 * Discriminated union of all actions that can be dispatched to the auth reducer.
 *
 * Each variant corresponds to a discrete state transition in the authentication
 * lifecycle. The reducer is intentionally pure — side effects (network calls,
 * async orchestration) live in the {@link AuthProvider} action callbacks which
 * dispatch these actions upon completion.
 */
export type AuthAction =
  | { type: "HYDRATING" }
  | { type: "AUTHENTICATING" }
  | { type: "AUTHENTICATED"; user: UserProfile | null; token: string | null }
  | { type: "HYDRATED"; user: UserProfile | null; token: string | null }
  | { type: "PROFILE_UPDATED"; user: UserProfile }
  | { type: "SIGN_OUT" }
  | { type: "ERROR"; error: string }
  | { type: "CLEAR_ERROR" };

/**
 * Pure reducer that computes the next authentication state for a given action.
 *
 * @param state The current authentication state.
 * @param action The dispatched action describing the intended transition.
 *
 * @returns The new authentication state.
 */
export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "HYDRATING":
      return { ...state, status: AuthStatus.HYDRATING, error: null };

    case "AUTHENTICATING":
      return { ...state, status: AuthStatus.AUTHENTICATING, error: null };

    case "AUTHENTICATED":
      return {
        status: AuthStatus.AUTHENTICATED,
        isHydrated: true,
        user: action.user,
        token: action.token,
        error: null,
      };

    case "HYDRATED":
      return {
        status: action.user ? AuthStatus.AUTHENTICATED : AuthStatus.IDLE,
        isHydrated: true,
        user: action.user,
        token: action.token,
        error: null,
      };

    case "PROFILE_UPDATED":
      return { ...state, user: action.user, error: null };

    case "SIGN_OUT":
      return { ...initialAuthState, isHydrated: true };

    case "ERROR":
      return { ...state, status: AuthStatus.ERROR, error: action.error };

    case "CLEAR_ERROR":
      return { ...state, status: AuthStatus.IDLE, error: null };
  }
}

/**
 * The shape of the value provided by the {@link AuthProvider} through React Context.
 *
 * Consumers receive both the current state snapshot and a set of action callbacks
 * that can be called to trigger state transitions (e.g. sign in, sign out, hydrate).
 */
export interface AuthContextValue {
  /** The current authentication state snapshot. */
  readonly state: AuthState;
  /** Stable action callbacks that trigger state transitions. */
  readonly actions: AuthActions;
}
