import type { SubmitEvent } from "react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { AuthStatus } from "#/features/auth/auth-store";
import { AuthForm } from "#/features/auth/components/auth-form";
import { useAuthStore, useUser } from "#/features/auth/hooks";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

/** Authentication page where players create or manage their anonymous session. */
export default function UserPage() {
  const navigate = useNavigate();
  const [displayNameInput, setDisplayNameInput] = useState("Commander");

  const status = useAuthStore((state) => state.status);
  const currentDisplayName = useUser((state) => state?.displayName ?? null);
  const lastError = useAuthStore((state) => state.error);
  const signInAnonymously = useAuthStore((state) => state.signInAnonymously);
  const signOut = useAuthStore((state) => state.signOut);
  const resetMatchConnection = useMatchConnectionStore((state) => state.reset);

  const handleSignIn = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      await signInAnonymously(displayNameInput);
      if (useAuthStore.getState().status === AuthStatus.AUTHENTICATED) {
        navigate("/lobby");
      }
    },
    [signInAnonymously, displayNameInput, navigate],
  );

  const handleSignOut = async () => {
    await resetMatchConnection();
    await signOut();
  };

  return (
    <AuthForm
      displayName={displayNameInput}
      onDisplayNameChange={setDisplayNameInput}
      isBusy={status === AuthStatus.AUTHENTICATING}
      isAuthenticated={status === AuthStatus.AUTHENTICATED}
      lastError={lastError}
      authStatus={status}
      currentDisplayName={currentDisplayName}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      onEnterLobby={() => navigate("/lobby")}
    />
  );
}
