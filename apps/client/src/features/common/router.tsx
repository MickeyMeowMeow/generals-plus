import type { ReactElement } from "react";
import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";

import App from "#/App";
import { UserPage } from "#/features/auth/pages/UserPage";
import { useUserAuthStore } from "#/features/auth/store/userAuthStore";
import { NotFoundPage } from "#/features/common/pages/NotFoundPage";
import { LobbyPage } from "#/features/lobby/pages/LobbyPage";
import { MatchPage } from "#/features/match/pages/MatchPage";
import { MatchScreen } from "#/features/match/components/MatchScreen";

// Route guard that redirects unauthenticated users to /user.
function RequireAuthenticated({ children }: { children: ReactElement }) {
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

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/user" replace />,
      },
      {
        path: "user",
        element: <UserPage />,
      },
      {
        path: "lobby",
        element: (
          <RequireAuthenticated>
            <LobbyPage />
          </RequireAuthenticated>
        ),
      },
      {
        path: "match/:roomName",
        element: (
          <RequireAuthenticated>
            <MatchPage />
          </RequireAuthenticated>
        ),
      },
      {
        path: "match-screen",
        element: <MatchScreen />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
