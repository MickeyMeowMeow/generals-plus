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

/** Route guard that redirects unauthenticated users to the root auth surface. */
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
