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
import { useUserAuthStore } from "#/features/auth/store/user-auth-store";

/** Route guard that redirects unauthenticated users to /user. */
export function RequireAuthenticated({ children }: { children: ReactElement }) {
  const hasHydrated = useUserAuthStore((state) => state.hasHydrated);
  const status = useUserAuthStore((state) => state.status);

  if (!hasHydrated || status === "hydrating" || status === "authenticating") {
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

  if (status !== "authenticated") {
    return <Navigate to="/user" replace />;
  }

  return children;
}
