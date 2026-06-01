import { useState } from "react";

import { BrandTitle, LoadingPanel, StageCenter } from "#/components/layout";
import { AuthStatus } from "#/features/auth/auth-store";
import type {
  GuestFormValues,
  RegisterFormValues,
  SignInFormValues,
} from "#/features/auth/components/auth-form";
import { AuthForm, AuthFormMode } from "#/features/auth/components/auth-form";
import { useAuth } from "#/features/auth/hooks";
import {
  MotionStaggerGroup,
  MotionStaggerItem,
} from "#/features/motion/components/motion-stagger";

/**
 * Root-route unauthenticated scene.
 *
 * The rebuilt client no longer has a `/user` route, so login/register behavior
 * lives directly inside `/`. Successful auth simply allows the root route to
 * render the official lobby without navigating.
 */
export function AuthPage() {
  const [mode, setMode] = useState<AuthFormMode>(AuthFormMode.SIGN_IN);
  const { state, actions } = useAuth();
  const isBusy = state.status === AuthStatus.AUTHENTICATING;

  if (!state.isHydrated || state.status === AuthStatus.HYDRATING) {
    return (
      <StageCenter>
        <LoadingPanel message="Checking session..." />
      </StageCenter>
    );
  }

  return (
    <StageCenter>
      <MotionStaggerGroup className="mx-auto grid max-w-4xl gap-7">
        <MotionStaggerItem>
          <BrandTitle />
        </MotionStaggerItem>
        <MotionStaggerItem className="mx-auto w-full max-w-md">
          <AuthForm
            mode={mode}
            onModeChange={(nextMode) => {
              if (isBusy) return;
              actions.clearError();
              setMode(nextMode);
            }}
            isBusy={isBusy}
            lastError={state.error}
            onSignIn={async ({ email, password }: SignInFormValues) => {
              await actions.signInWithEmailAndPassword(email, password);
            }}
            onRegister={async (values: RegisterFormValues) => {
              await actions.registerWithEmailAndPassword(values);
            }}
            onGuestSignIn={async ({ displayName }: GuestFormValues) => {
              await actions.signInAnonymously(displayName);
            }}
          />
        </MotionStaggerItem>
      </MotionStaggerGroup>
    </StageCenter>
  );
}
