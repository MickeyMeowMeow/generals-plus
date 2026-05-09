import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import type { AuthContextValue } from "#/features/auth/auth-store";
import AppLayout from "#/routes/_app";
import IndexRoute from "#/routes/_index";
import LobbyRoute from "#/routes/lobby";
import MatchRoute from "#/routes/match.$roomId";
import NotFoundRoute from "#/routes/not-found";
import UserRoute from "#/routes/user";
import { setTestAuthValue } from "./test-auth-state";

export { setTestAuthValue as setAuthValue } from "./test-auth-state";

export const defaultRoutes = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <IndexRoute /> },
      { path: "user", element: <UserRoute /> },
      { path: "lobby", element: <LobbyRoute /> },
      { path: "match/:roomId", element: <MatchRoute /> },
      { path: "*", element: <NotFoundRoute /> },
    ],
  },
];

export function renderRoute(
  initialPath: string,
  authValue: AuthContextValue,
  routes = defaultRoutes,
) {
  setTestAuthValue(authValue);

  const router = createMemoryRouter(routes, {
    initialEntries: [initialPath],
  });

  return render(<RouterProvider router={router} />);
}
