import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";

import App from "#/App";
import { NotFoundPage } from "#/features/common/pages/NotFoundPage";
import { LobbyPage } from "#/features/lobby/pages/LobbyPage";
import { MatchPage } from "#/features/match/pages/MatchPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/lobby" replace />,
      },
      {
        path: "lobby",
        element: <LobbyPage />,
      },
      {
        path: "match/:roomName",
        element: <MatchPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
