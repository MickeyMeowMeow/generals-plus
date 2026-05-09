// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "#/features/auth/auth-store";
import AppLayout from "#/routes/_app";
import IndexRoute from "#/routes/_index";
import LobbyRoute from "#/routes/lobby";
import MatchRoute from "#/routes/match.$roomId";
import NotFoundRoute from "#/routes/not-found";
import UserRoute from "#/routes/user";

function renderRoute(initialPath: string, authValue: AuthContextValue) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppLayout authValue={authValue} />,
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

/** Creates a mock {@link AuthContextValue} with sensible defaults. */
function createMockAuth(
  overrides: Partial<AuthContextValue["state"]> = {},
): AuthContextValue {
  return {
    state: {
      status: "idle",
      isHydrated: true,
      user: null,
      token: null,
      error: null,
      ...overrides,
    },
    actions: {
      hydrate: vi.fn().mockResolvedValue(undefined),
      signInAnonymously: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
      clearError: vi.fn(),
    },
  };
}

describe("app routes", () => {
  let auth: AuthContextValue;

  beforeEach(() => {
    auth = createMockAuth();
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects root path to user page", async () => {
    renderRoute("/", auth);
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("renders lobby for authenticated players", async () => {
    auth = createMockAuth({
      status: "authenticated",
      user: { id: "scout", displayName: "Scout" },
      token: "token-1",
    });

    renderRoute("/lobby", auth);
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("redirects unauthenticated players away from protected routes", async () => {
    renderRoute("/match/alpha-room", auth);
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("renders not found page for unknown path", async () => {
    renderRoute("/unknown", auth);
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
  });
});
