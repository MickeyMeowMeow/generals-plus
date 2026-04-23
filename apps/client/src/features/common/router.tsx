import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";

import App from "../../App";
import { LobbyPage } from "../lobby/pages/LobbyPage";
import { MatchPage } from "../match/pages/MatchPage";
import { NotFoundPage } from "./pages/NotFoundPage";

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
