import { Loader2, LogIn } from "lucide-react";
import type { SubmitEvent } from "react";

import { ErrorAlert } from "#/components/feedback/error-alert";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

interface AuthFormProps {
  /** Draft commander name controlled by the route-level auth scene. */
  displayName: string;
  /** Updates the draft commander name before anonymous sign-in. */
  onDisplayNameChange: (value: string) => void;
  /** Disables submit affordances while an auth request is running. */
  isBusy: boolean;
  /** Last auth error surfaced by the provider, if any. */
  lastError: string | null;
  /** Form submit handler supplied by the route that owns auth actions. */
  onSignIn: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * Plain anonymous auth form used by both root and custom-room URLs.
 *
 * The form contains no routing assumptions. `/` uses it as the first official
 * flow scene, while `/match/:roomId` uses the same component so a shared custom
 * room URL can authenticate in place and continue joining that room afterward.
 */
export function AuthForm({
  displayName,
  onDisplayNameChange,
  isBusy,
  lastError,
  onSignIn,
}: AuthFormProps) {
  return (
    <form
      onSubmit={onSignIn}
      className="game-panel space-y-4 rounded-none p-5 text-game-text"
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Sign in</h2>
        <p className="text-sm text-game-text-dim">
          Choose a display name to enter the game.
        </p>
      </div>

      <ErrorAlert message={lastError} />

      <div className="space-y-1.5">
        <Label htmlFor="display-name" className="text-game-text-dim">
          Display name
        </Label>
        <Input
          id="display-name"
          name="displayName"
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          autoComplete="nickname"
          className="border-game-border bg-game-bg text-game-text"
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
  );
}
