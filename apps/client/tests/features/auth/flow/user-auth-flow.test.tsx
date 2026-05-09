// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "#/features/auth/auth-store";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";
import AppLayout from "#/routes/_app";
import IndexRoute from "#/routes/_index";
import LobbyRoute from "#/routes/lobby";
import MatchRoute from "#/routes/match.$roomId";
import NotFoundRoute from "#/routes/not-found";
import UserRoute from "#/routes/user";

const initialMatchState = useMatchConnectionStore.getInitialState();

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

describe("user auth flow", () => {
  let auth: AuthContextValue;

  beforeEach(() => {
    auth = createMockAuth();
    useMatchConnectionStore.setState(initialMatchState, true);
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects unauthenticated players to user page", async () => {
    renderRoute("/lobby", auth);
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("signs in from user page and enters lobby", async () => {
    const signInAnonymously = vi
      .fn()
      .mockImplementation(async (name: string) => {
        auth = createMockAuth({
          status: "authenticated",
          user: { id: name, displayName: name },
          token: "token-1",
        });
        auth.actions.signInAnonymously = signInAnonymously;
      });

    auth.actions.signInAnonymously = signInAnonymously;

    const user = userEvent.setup();
    renderRoute("/user", auth);

    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Nova");
    await user.click(
      screen.getByRole("button", { name: "Sign in anonymously" }),
    );

    expect(signInAnonymously).toHaveBeenCalledWith("Nova");
  });

  it("signs out from user page and clears active room state", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const resetMatchConnection = vi.fn().mockResolvedValue(undefined);

    auth = createMockAuth({
      status: "authenticated",
      user: { id: "helix", displayName: "Helix" },
      token: "token-2",
    });
    auth.actions.signOut = signOut;

    useMatchConnectionStore.setState({
      reset: resetMatchConnection,
    });

    const user = userEvent.setup();
    renderRoute("/user", auth);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(resetMatchConnection).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
