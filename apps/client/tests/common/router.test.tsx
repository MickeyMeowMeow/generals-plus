// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserAuthStore } from "#/features/auth/store/userAuthStore";
import AppLayout from "#/routes/_app";
import IndexRoute from "#/routes/_index";
import LobbyRoute from "#/routes/lobby";
import MatchRoute from "#/routes/match.$roomId";
import NotFoundRoute from "#/routes/not-found";
import UserRoute from "#/routes/user";

function renderRoute(initialPath: string) {
  const router = createMemoryRouter(
    [
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
    ],
    {
      initialEntries: [initialPath],
    },
  );

  return render(<RouterProvider router={router} />);
}

describe("app routes", () => {
  const initialAuthState = useUserAuthStore.getInitialState();

  beforeEach(() => {
    useUserAuthStore.setState(initialAuthState, true);
    useUserAuthStore.setState({
      hydrateUser: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects root path to user page", async () => {
    renderRoute("/");
    expect(await screen.findByRole("heading", { name: "User" })).toBeTruthy();
  });

  it("renders lobby for authenticated players", async () => {
    useUserAuthStore.setState({
      status: "authenticated",
      hasHydrated: true,
      displayName: "Scout",
      user: { name: "Scout" },
      token: "token-1",
      lastError: null,
    });

    renderRoute("/lobby");
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("redirects unauthenticated players away from protected routes", async () => {
    useUserAuthStore.setState({
      status: "idle",
      hasHydrated: true,
      displayName: null,
      user: null,
      token: null,
      lastError: null,
    });

    renderRoute("/match/alpha-room");
    expect(await screen.findByRole("heading", { name: "User" })).toBeTruthy();
  });

  it("renders not found page for unknown path", async () => {
    renderRoute("/unknown");
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
  });
});
