import type { ReactElement } from "react";
import { Navigate } from "react-router";

import { useUserAuthStore } from "#/features/auth/store/userAuthStore";

// Route guard that redirects unauthenticated users to /user.
export function RequireAuthenticated({ children }: { children: ReactElement }) {
  const hasHydrated = useUserAuthStore((state) => state.hasHydrated);
  const status = useUserAuthStore((state) => state.status);

  if (!hasHydrated || status === "hydrating" || status === "authenticating") {
    return (
      <section className="page" aria-label="Session Bootstrap Page">
        <h2>Checking session</h2>
        <p>Loading authenticated player context.</p>
      </section>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/user" replace />;
  }

  return children;
}
