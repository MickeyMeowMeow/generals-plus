import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import { Navigate } from "react-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { AuthStatus } from "#/features/auth/auth-store";
import { useAuth } from "#/features/auth/hooks";

/**
 * Legacy-compatible authenticated route guard.
 *
 * The rebuilt primary flows handle unauthenticated users inside `/` and
 * `/match/:roomId`, but tests and any future protected utility routes can still
 * use this guard. Unauthenticated users are sent to the root auth surface rather
 * than to the removed `/user` route.
 */
export function RequireAuthenticated({ children }: { children: ReactElement }) {
  const { state } = useAuth();

  if (
    !state.isHydrated ||
    state.status === AuthStatus.HYDRATING ||
    state.status === AuthStatus.AUTHENTICATING
  ) {
    return (
      <div className="flex flex-1 items-center justify-center p-5">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Checking session</CardTitle>
            <CardDescription>
              Loading authenticated player context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status !== AuthStatus.AUTHENTICATED) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * Route guard that only permits authenticated administrators.
 * Redirects regular players to the lobby root page immediately.
 */
export function RequireAdmin({ children }: { children: ReactElement }) {
  const { state } = useAuth();
  const user = state.user;

  if (
    !state.isHydrated ||
    state.status === AuthStatus.HYDRATING ||
    state.status === AuthStatus.AUTHENTICATING
  ) {
    return (
      <div className="flex flex-1 items-center justify-center p-5">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Checking session</CardTitle>
            <CardDescription>
              Loading authenticated player context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status !== AuthStatus.AUTHENTICATED || !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
