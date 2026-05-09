import type { SubmitEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AuthStatus } from "#/features/auth/auth-store";
import { AuthForm } from "#/features/auth/components/auth-form";
import { useAuth, useUser } from "#/features/auth/hooks";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

/** Authentication page where players create or manage their anonymous session. */
export default function UserPage() {
  const navigate = useNavigate();
  const [displayNameInput, setDisplayNameInput] = useState("Commander");

  const { state, actions } = useAuth();
  const currentDisplayName = useUser((user) => user?.displayName ?? null);
  const resetMatchConnection = useMatchConnectionStore((s) => s.reset);

  /** Ref to read the latest state inside async callbacks without stale closures. */
  const stateRef = useRef(state);
  stateRef.current = state;

  const handleSignIn = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      await actions.signInAnonymously(displayNameInput);
      if (stateRef.current.status === AuthStatus.AUTHENTICATED) {
        navigate("/lobby");
      }
    },
    [actions.signInAnonymously, displayNameInput, navigate],
  );

  const handleSignOut = async () => {
    await resetMatchConnection();
    await actions.signOut();
  };

  return (
    <AuthForm
      displayName={displayNameInput}
      onDisplayNameChange={setDisplayNameInput}
      isBusy={state.status === AuthStatus.AUTHENTICATING}
      isAuthenticated={state.status === AuthStatus.AUTHENTICATED}
      lastError={state.error}
      authStatus={state.status}
      currentDisplayName={currentDisplayName}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      onEnterLobby={() => navigate("/lobby")}
    />
  );
}
