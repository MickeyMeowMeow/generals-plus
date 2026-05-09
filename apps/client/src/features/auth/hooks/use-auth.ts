import { useContext } from "react";

import type { AuthContextValue } from "#/features/auth/auth-store";
import { AuthContext } from "#/features/auth/providers/auth-provider";

/**
 * Hook that provides access to the authentication state and actions from the
 * nearest {@link AuthProvider} in the component tree.
 *
 * Returns a stable context value containing:
 * - `state` — the current {@link AuthState} snapshot.
 * - `actions` — stable callbacks (`hydrate`, `signInAnonymously`, `signOut`,
 *   `clearError`) that trigger state transitions.
 *
 * @returns The authentication context value.
 *
 * @throws {Error} If called outside of an `<AuthProvider>`.
 *
 * @example
 * ```tsx
 * function PlayerInfo() {
 *   const { state, actions } = useAuth();
 *   return (
 *     <div>
 *       <p>Status: {state.status}</p>
 *       <button onClick={() => actions.signOut()}>Sign out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}
