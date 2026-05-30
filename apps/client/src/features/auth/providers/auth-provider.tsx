import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import type { UserProfile } from "#/common/types/user-profile";
import type {
  AuthContextValue,
  AuthState,
  RegisterWithEmailInput,
} from "#/features/auth/auth-store";
import {
  AuthStatus,
  authReducer,
  initialAuthState,
} from "#/features/auth/auth-store";
import type { AuthData } from "#/infra/network/auth";
import type { NetworkProvider } from "#/infra/network/provider";
import { networkProvider } from "#/infra/network/provider";

/**
 * React Context that holds the current authentication state and action callbacks.
 *
 * The value is `null` when no {@link AuthProvider} has been mounted in the
 * component tree. The {@link useAuth} hook will throw a descriptive error in
 * that case.
 *
 * @internal This context is not exported publicly. It is consumed only by the
 * hook wrappers inside the auth feature.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

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

function toHumanReadableAuthError(error: unknown, fallback: string): string {
  const message = normalizeError(error, fallback).trim();
  const normalized = message.toLowerCase();

  if (
    normalized === "invalid_credentials" ||
    normalized === "invalid-credentials"
  ) {
    return "Incorrect email or password.";
  }

  if (
    normalized === "already_exists" ||
    normalized === "email_already_exists" ||
    normalized === "user_already_exists" ||
    normalized.includes("duplicate key") ||
    normalized.includes("e11000")
  ) {
    return "An account with this email already exists.";
  }

  if (normalized === "email_not_verified") {
    return "Please verify your email address before signing in.";
  }

  if (normalized === "too_many_requests") {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (/^[a-z0-9_-]+$/i.test(message)) {
    return fallback;
  }

  return message;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Props accepted by the {@link AuthProvider} component.
 */
interface AuthProviderProps {
  /**
   * An optional {@link NetworkProvider} used for network operations.
   *
   * Ignored when `value` is provided. Defaults to the global
   * {@link networkProvider} singleton when omitted.
   */
  provider?: NetworkProvider<UserProfile>;

  /** The React element tree that will have access to the auth context. */
  children: ReactNode;
}

/**
 * React Context Provider that manages the authentication state machine.
 *
 * On mount the provider:
 * 1. Initializes a reducer-backed state via {@link authReducer}.
 * 2. Registers a real-time listener for server-pushed auth changes via
 *    `provider.onAuthChange`.
 * 3. Triggers automatic session hydration by dispatching the `hydrate` action.
 *
 * Descendant components should access state and actions through the
 * {@link useAuth} hook rather than reading the context directly.
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <AppLayout />
 * </AuthProvider>
 *
 * // In a descendant component:
 * const { state, actions } = useAuth();
 * ```
 */
export function AuthProvider({
  provider = networkProvider,
  children,
}: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  /**
   * Ref that tracks the latest state snapshot.
   *
   * This allows async action callbacks to read the most recent state without
   * capturing stale closures. The ref is updated synchronously on every render,
   * so it is always up-to-date when an async callback resumes.
   */
  const stateRef = useRef<AuthState>(state);
  stateRef.current = state;

  /**
   * Ref used to deduplicate concurrent hydration attempts.
   *
   * If `hydrate()` is called while a previous hydration is still in flight
   * (e.g. React StrictMode double-mount), the second call awaits the existing
   * promise instead of starting a new network request.
   */
  const hydrationRef = useRef<Promise<void> | null>(null);

  const hydrate = useCallback(async () => {
    const { isHydrated, status } = stateRef.current;

    // Bail out if already hydrated or currently processing an auth request.
    if (isHydrated || status === AuthStatus.AUTHENTICATING) return;

    // If a hydration is already in flight, wait for it rather than starting another.
    if (hydrationRef.current) {
      await hydrationRef.current;
      return;
    }

    dispatch({ type: "HYDRATING" });

    hydrationRef.current = (async () => {
      try {
        const user = await provider.getUserData();
        dispatch({ type: "HYDRATED", user, token: provider.getAuthToken() });
      } catch {
        // A failure to hydrate simply means no active session exists.
        dispatch({
          type: "HYDRATED",
          user: null,
          token: provider.getAuthToken(),
        });
      }
    })();

    try {
      await hydrationRef.current;
    } finally {
      hydrationRef.current = null;
    }
  }, [provider]);

  const signInAnonymously = useCallback(
    async (displayName: string, metadata: Record<string, unknown> = {}) => {
      const trimmedName = displayName.trim();
      if (trimmedName.length === 0) {
        dispatch({ type: "ERROR", error: "Display name cannot be empty." });
        return;
      }

      dispatch({ type: "AUTHENTICATING" });

      try {
        const response = await provider.signInAnonymously({
          name: trimmedName,
          displayName: trimmedName,
          ...metadata,
        });

        dispatch({
          type: "AUTHENTICATED",
          user: response.user,
          token: response.token ?? provider.getAuthToken(),
        });
      } catch (error) {
        dispatch({
          type: "ERROR",
          error: toHumanReadableAuthError(error, "Failed to sign in as guest."),
        });
      }
    },
    [provider],
  );

  const signInWithEmailAndPassword = useCallback(
    async (email: string, password: string) => {
      const trimmedEmail = email.trim();

      if (trimmedEmail.length === 0) {
        dispatch({ type: "ERROR", error: "Email cannot be empty." });
        return;
      }

      if (!isValidEmail(trimmedEmail)) {
        dispatch({ type: "ERROR", error: "Enter a valid email address." });
        return;
      }

      if (password.length === 0) {
        dispatch({ type: "ERROR", error: "Password cannot be empty." });
        return;
      }

      dispatch({ type: "AUTHENTICATING" });

      try {
        const response = await provider.signInWithEmailAndPassword(
          trimmedEmail,
          password,
        );

        dispatch({
          type: "AUTHENTICATED",
          user: response.user,
          token: response.token ?? provider.getAuthToken(),
        });
      } catch (error) {
        dispatch({
          type: "ERROR",
          error: toHumanReadableAuthError(
            error,
            "Failed to sign in with email and password.",
          ),
        });
      }
    },
    [provider],
  );

  const registerWithEmailAndPassword = useCallback(
    async ({ displayName, email, password }: RegisterWithEmailInput) => {
      const trimmedName = displayName.trim();
      const trimmedEmail = email.trim();

      if (trimmedName.length === 0) {
        dispatch({ type: "ERROR", error: "Display name cannot be empty." });
        return;
      }

      if (trimmedEmail.length === 0) {
        dispatch({ type: "ERROR", error: "Email cannot be empty." });
        return;
      }

      if (!isValidEmail(trimmedEmail)) {
        dispatch({ type: "ERROR", error: "Enter a valid email address." });
        return;
      }

      if (password.length < 8) {
        dispatch({
          type: "ERROR",
          error: "Password must be at least 8 characters.",
        });
        return;
      }

      dispatch({ type: "AUTHENTICATING" });

      try {
        const response = await provider.registerWithEmailAndPassword(
          trimmedEmail,
          password,
          {
            displayName: trimmedName,
          },
        );

        dispatch({
          type: "AUTHENTICATED",
          user: response.user,
          token: response.token ?? provider.getAuthToken(),
        });
      } catch (error) {
        dispatch({
          type: "ERROR",
          error: toHumanReadableAuthError(
            error,
            "Failed to create your account with email and password.",
          ),
        });
      }
    },
    [provider],
  );

  const signOut = useCallback(async () => {
    try {
      await provider.signOut();
      dispatch({ type: "SIGN_OUT" });
    } catch (error) {
      dispatch({
        type: "ERROR",
        error: normalizeError(error, "An error occurred during sign out."),
      });
    }
  }, [provider]);

  const updateUserProfile = useCallback(
    async (update: Partial<UserProfile>) => {
      try {
        const user = await provider.updateUserProfile(update);
        dispatch({ type: "PROFILE_UPDATED", user });
      } catch (error) {
        dispatch({
          type: "ERROR",
          error: normalizeError(error, "Failed to update profile."),
        });
        throw error;
      }
    },
    [provider],
  );

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const actions = useMemo(
    () => ({
      hydrate,
      signInWithEmailAndPassword,
      registerWithEmailAndPassword,
      signInAnonymously,
      signOut,
      updateUserProfile,
      clearError,
    }),
    [
      hydrate,
      signInWithEmailAndPassword,
      registerWithEmailAndPassword,
      signInAnonymously,
      signOut,
      updateUserProfile,
      clearError,
    ],
  );

  const contextValue = useMemo<AuthContextValue>(
    () => ({ state, actions }),
    [state, actions],
  );

  // Subscribe to real-time auth state changes pushed by the server.
  useEffect(() => {
    const unsubscribe = provider.onAuthChange<UserProfile>(
      (response: AuthData<UserProfile>) => {
        dispatch({
          type: "HYDRATED",
          user: response.user,
          token: response.token,
        });
      },
    );
    return unsubscribe;
  }, [provider]);

  // Trigger automatic hydration on mount.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}
