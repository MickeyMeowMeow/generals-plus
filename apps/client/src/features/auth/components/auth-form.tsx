import { Loader2, LogIn, ShieldUser, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";

import { ErrorAlert } from "#/components/feedback/error-alert";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

export const AuthFormMode = {
  SIGN_IN: "sign-in",
  REGISTER: "register",
  GUEST: "guest",
} as const;

export type AuthFormMode = (typeof AuthFormMode)[keyof typeof AuthFormMode];

export interface SignInFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  displayName: string;
  email: string;
  password: string;
}

export interface GuestFormValues {
  displayName: string;
}

interface AuthFormProps {
  mode: AuthFormMode;
  onModeChange: (mode: AuthFormMode) => void;
  isBusy: boolean;
  lastError: string | null;
  onSignIn: (values: SignInFormValues) => Promise<void>;
  onRegister: (values: RegisterFormValues) => Promise<void>;
  onGuestSignIn: (values: GuestFormValues) => Promise<void>;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/**
 * Shared auth form used by both root and custom-room URLs.
 *
 * The component intentionally stays route-agnostic so `/` and `/match/:roomId`
 * can reuse the same sign-in, registration, and guest-entry experience.
 */
export function AuthForm({
  mode,
  onModeChange,
  isBusy,
  lastError,
  onSignIn,
  onRegister,
  onGuestSignIn,
}: AuthFormProps) {
  const signInForm = useForm<SignInFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const registerForm = useForm<RegisterFormValues>({
    defaultValues: {
      displayName: "Commander",
      email: "",
      password: "",
    },
  });
  const guestForm = useForm<GuestFormValues>({
    defaultValues: {
      displayName: "Commander",
    },
  });
  const isRegisterMode = mode === AuthFormMode.REGISTER;
  const isGuestMode = mode === AuthFormMode.GUEST;

  const syncSharedDrafts = () => {
    const displayName =
      mode === AuthFormMode.GUEST
        ? guestForm.getValues("displayName")
        : mode === AuthFormMode.REGISTER
          ? registerForm.getValues("displayName")
          : registerForm.getValues("displayName");
    const email =
      mode === AuthFormMode.REGISTER
        ? registerForm.getValues("email")
        : signInForm.getValues("email");

    registerForm.setValue("displayName", displayName, {
      shouldDirty: displayName !== "Commander",
    });
    guestForm.setValue("displayName", displayName, {
      shouldDirty: displayName !== "Commander",
    });
    registerForm.setValue("email", email, {
      shouldDirty: email.length > 0,
    });
    signInForm.setValue("email", email, {
      shouldDirty: email.length > 0,
    });
  };

  const handleModeChange = (nextMode: AuthFormMode) => {
    syncSharedDrafts();
    onModeChange(nextMode);
  };

  return (
    <section className="game-panel space-y-5 rounded-none p-5 text-game-text">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">
          {isRegisterMode
            ? "Create account"
            : isGuestMode
              ? "Continue as guest"
              : "Sign in"}
        </h2>
      </div>

      <div
        className="grid grid-cols-3 gap-2"
        role="tablist"
        aria-label="Authentication mode"
      >
        <Button
          type="button"
          variant={!isRegisterMode && !isGuestMode ? "default" : "outline"}
          onClick={() => handleModeChange(AuthFormMode.SIGN_IN)}
          role="tab"
          aria-selected={!isRegisterMode && !isGuestMode}
          disabled={isBusy}
        >
          <LogIn className="size-4" />
          Log in
        </Button>
        <Button
          type="button"
          variant={isRegisterMode ? "default" : "outline"}
          onClick={() => handleModeChange(AuthFormMode.REGISTER)}
          role="tab"
          aria-selected={isRegisterMode}
          disabled={isBusy}
        >
          <UserPlus className="size-4" />
          Register
        </Button>
        <Button
          type="button"
          variant={isGuestMode ? "default" : "outline"}
          onClick={() => handleModeChange(AuthFormMode.GUEST)}
          role="tab"
          aria-selected={isGuestMode}
          disabled={isBusy}
        >
          <ShieldUser className="size-4" />
          Guest
        </Button>
      </div>

      <ErrorAlert message={lastError} />

      {isRegisterMode ? (
        <form
          key={AuthFormMode.REGISTER}
          onSubmit={registerForm.handleSubmit(async (values) =>
            onRegister({
              displayName: values.displayName.trim(),
              email: values.email.trim(),
              password: values.password,
            }),
          )}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="register-display-name"
              className="text-game-text-dim"
            >
              Display name
            </Label>
            <Input
              id="register-display-name"
              autoComplete="nickname"
              aria-invalid={
                registerForm.formState.errors.displayName ? true : undefined
              }
              className="border-game-border bg-game-bg text-game-text"
              {...registerForm.register("displayName", {
                validate: (value) =>
                  value.trim().length > 0 || "Display name cannot be empty.",
              })}
            />
            <FieldError
              message={registerForm.formState.errors.displayName?.message}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="register-email" className="text-game-text-dim">
              Email
            </Label>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              aria-invalid={
                registerForm.formState.errors.email ? true : undefined
              }
              className="border-game-border bg-game-bg text-game-text"
              {...registerForm.register("email", {
                validate: (value) => {
                  const trimmed = value.trim();
                  if (trimmed.length === 0) return "Email cannot be empty.";
                  return (
                    isValidEmail(trimmed) || "Enter a valid email address."
                  );
                },
              })}
            />
            <FieldError
              message={registerForm.formState.errors.email?.message}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="register-password" className="text-game-text-dim">
              Password
            </Label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={
                registerForm.formState.errors.password ? true : undefined
              }
              className="border-game-border bg-game-bg text-game-text"
              {...registerForm.register("password", {
                required: "Password cannot be empty.",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters.",
                },
              })}
            />
            <FieldError
              message={registerForm.formState.errors.password?.message}
            />
          </div>

          <Button type="submit" disabled={isBusy} className="w-full">
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {isBusy ? "Creating account..." : "Create account"}
          </Button>
        </form>
      ) : isGuestMode ? (
        <form
          key={AuthFormMode.GUEST}
          onSubmit={guestForm.handleSubmit(async (values) =>
            onGuestSignIn({
              displayName: values.displayName.trim(),
            }),
          )}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="guest-display-name" className="text-game-text-dim">
              Display name
            </Label>
            <Input
              id="guest-display-name"
              autoComplete="nickname"
              aria-invalid={
                guestForm.formState.errors.displayName ? true : undefined
              }
              className="border-game-border bg-game-bg text-game-text"
              {...guestForm.register("displayName", {
                validate: (value) =>
                  value.trim().length > 0 || "Display name cannot be empty.",
              })}
            />
            <FieldError
              message={guestForm.formState.errors.displayName?.message}
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            disabled={isBusy}
            className="w-full"
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {isBusy ? "Entering..." : "Enter as guest"}
          </Button>
        </form>
      ) : (
        <form
          key={AuthFormMode.SIGN_IN}
          onSubmit={signInForm.handleSubmit(async (values) =>
            onSignIn({
              email: values.email.trim(),
              password: values.password,
            }),
          )}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="sign-in-email" className="text-game-text-dim">
              Email
            </Label>
            <Input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              aria-invalid={
                signInForm.formState.errors.email ? true : undefined
              }
              className="border-game-border bg-game-bg text-game-text"
              {...signInForm.register("email", {
                validate: (value) => {
                  const trimmed = value.trim();
                  if (trimmed.length === 0) return "Email cannot be empty.";
                  return (
                    isValidEmail(trimmed) || "Enter a valid email address."
                  );
                },
              })}
            />
            <FieldError message={signInForm.formState.errors.email?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sign-in-password" className="text-game-text-dim">
              Password
            </Label>
            <Input
              id="sign-in-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={
                signInForm.formState.errors.password ? true : undefined
              }
              className="border-game-border bg-game-bg text-game-text"
              {...signInForm.register("password", {
                required: "Password cannot be empty.",
              })}
            />
            <FieldError
              message={signInForm.formState.errors.password?.message}
            />
          </div>

          <Button type="submit" disabled={isBusy} className="w-full">
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            {isBusy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      )}
    </section>
  );
}
