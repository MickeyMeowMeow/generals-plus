// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "#/features/auth/hooks";
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
  const initialAuthState = useAuthStore.getInitialState();

  beforeEach(() => {
    useAuthStore.setState(initialAuthState, true);
    useAuthStore.setState({
      hydrate: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects root path to user page", async () => {
    renderRoute("/");
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("renders lobby for authenticated players", async () => {
    useAuthStore.setState({
      status: "authenticated",
      isHydrated: true,
      user: {
        id: "scout",
        displayName: "Scout",
      },
      token: "token-1",
      error: null,
    });

    renderRoute("/lobby");
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("redirects unauthenticated players away from protected routes", async () => {
    useAuthStore.setState({
      status: "idle",
      isHydrated: true,
      user: null,
      token: null,
      error: null,
    });

    renderRoute("/match/alpha-room");
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("renders not found page for unknown path", async () => {
    renderRoute("/unknown");
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
  });
});
