import type { SubmitEvent } from "react";
import { useCallback, useState } from "react";

import { BrandTitle, LoadingPanel, StageCenter } from "#/components/layout";
import { AuthStatus } from "#/features/auth/auth-store";
import { AuthForm } from "#/features/auth/components/auth-form";
import { useAuth } from "#/features/auth/hooks";

/**
 * Root-route unauthenticated scene.
 *
 * The rebuilt client no longer has a `/user` route, so login/register behavior
 * lives directly inside `/`. Successful auth simply allows the root route to
 * render the official lobby without navigating.
 */
export function AuthPage() {
  const [displayNameInput, setDisplayNameInput] = useState("Commander");
  const { state, actions } = useAuth();

  const handleSignIn = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      await actions.signInAnonymously(displayNameInput);
    },
    [actions.signInAnonymously, displayNameInput],
  );

  if (
    !state.isHydrated ||
    state.status === AuthStatus.HYDRATING ||
    state.status === AuthStatus.AUTHENTICATING
  ) {
    return (
      <StageCenter>
        <LoadingPanel message="Checking session..." />
      </StageCenter>
    );
  }

  return (
    <StageCenter>
      <div className="mx-auto grid max-w-4xl gap-7">
        <BrandTitle />
        <div className="mx-auto w-full max-w-md">
          <AuthForm
            displayName={displayNameInput}
            onDisplayNameChange={setDisplayNameInput}
            isBusy={false}
            lastError={state.error}
            onSignIn={handleSignIn}
          />
        </div>
      </div>
    </StageCenter>
  );
}
