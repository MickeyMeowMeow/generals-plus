import { Loader2, LogIn, LogOut } from "lucide-react";
import type { SubmitEvent } from "react";

import { ErrorAlert } from "#/components/feedback/error-alert";
import { StatusBadge } from "#/components/feedback/status-badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

interface AuthFormProps {
  /** Draft commander name controlled by the route-level auth scene. */
  displayName: string;
  /** Updates the draft commander name before anonymous sign-in. */
  onDisplayNameChange: (value: string) => void;
  /** Disables submit affordances while an auth request is running. */
  isBusy: boolean;
  /** Whether the auth provider currently has a signed-in player. */
  isAuthenticated: boolean;
  /** Last auth error surfaced by the provider, if any. */
  lastError: string | null;
  /** Raw auth status label rendered through the shared status badge. */
  authStatus: string;
  /** Display name for the active player session. */
  currentDisplayName: string | null;
  /** Form submit handler supplied by the route that owns auth actions. */
  onSignIn: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
  /** Signs out the current player and clears route-level connection state. */
  onSignOut: () => Promise<void>;
  /** Optional authenticated continuation; root routes currently stay in place. */
  onEnterLobby: () => void;
}

/**
 * Stage-styled anonymous auth form used by both root and custom-room URLs.
 *
 * The form contains no routing assumptions. `/` uses it as the first official
 * flow scene, while `/match/:roomId` uses the same component so a shared custom
 * room URL can authenticate in place and continue joining that room afterward.
 */
export function AuthForm({
  displayName,
  onDisplayNameChange,
  isBusy,
  isAuthenticated,
  lastError,
  authStatus,
  currentDisplayName,
  onSignIn,
  onSignOut,
  onEnterLobby,
}: AuthFormProps) {
  return (
    <Card className="game-panel border-white/10 bg-transparent text-game-text shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl font-black uppercase">
          <h2>Sign In</h2>
        </CardTitle>
        <CardDescription className="text-game-text-dim">
          Choose your commander name before entering the war room.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <StatusBadge status={authStatus} />
        </div>

        {isAuthenticated && currentDisplayName ? (
          <p className="text-sm">
            Active player: <strong>{currentDisplayName}</strong>
          </p>
        ) : null}

        <ErrorAlert message={lastError} />

        <form onSubmit={onSignIn} className="space-y-3">
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
              className="border-white/15 bg-black/30 text-game-text"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isBusy}>
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              {isBusy ? "Signing in..." : "Sign in anonymously"}
            </Button>

            {isAuthenticated ? (
              <Button type="button" variant="outline" onClick={onEnterLobby}>
                Enter war room
              </Button>
            ) : null}

            {isAuthenticated ? (
              <Button type="button" variant="ghost" onClick={onSignOut}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
