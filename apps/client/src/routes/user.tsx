import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { PageContainer } from "#/components/layout/page-container";
import { AuthForm } from "#/features/auth/components/auth-form";
import { useUserAuthStore } from "#/features/auth/store/user-auth-store";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";

/** Authentication page where players create or manage their anonymous session. */
export default function UserPage() {
  const navigate = useNavigate();
  const [displayNameInput, setDisplayNameInput] = useState("Commander");

  const status = useUserAuthStore((state) => state.status);
  const currentDisplayName = useUserAuthStore((state) => state.displayName);
  const lastError = useUserAuthStore((state) => state.lastError);
  const signInAnonymously = useUserAuthStore(
    (state) => state.signInAnonymously,
  );
  const signOut = useUserAuthStore((state) => state.signOut);
  const resetMatchConnection = useMatchConnectionStore((state) => state.reset);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signInAnonymously(displayNameInput);
    if (useUserAuthStore.getState().status === "authenticated") {
      navigate("/lobby");
    }
  };

  const handleSignOut = async () => {
    await resetMatchConnection();
    await signOut();
  };

  return (
    <PageContainer>
      <AuthForm
        displayName={displayNameInput}
        onDisplayNameChange={setDisplayNameInput}
        isBusy={status === "authenticating"}
        isAuthenticated={status === "authenticated"}
        lastError={lastError}
        authStatus={status}
        currentDisplayName={currentDisplayName}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onEnterLobby={() => navigate("/lobby")}
      />
    </PageContainer>
  );
}
