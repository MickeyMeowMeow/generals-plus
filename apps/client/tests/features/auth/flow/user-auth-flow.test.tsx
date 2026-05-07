// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "#/features/auth/hooks";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";
import AppLayout from "#/routes/_app";
import IndexRoute from "#/routes/_index";
import LobbyRoute from "#/routes/lobby";
import MatchRoute from "#/routes/match.$roomId";
import NotFoundRoute from "#/routes/not-found";
import UserRoute from "#/routes/user";

const initialAuthState = useAuthStore.getInitialState();
const initialMatchState = useMatchConnectionStore.getInitialState();

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

describe("user auth flow", () => {
  beforeEach(() => {
    useAuthStore.setState(initialAuthState, true);
    useMatchConnectionStore.setState(initialMatchState, true);
    useAuthStore.setState({
      hydrate: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects unauthenticated players to user page", async () => {
    useAuthStore.setState({
      status: "idle",
      isHydrated: true,
      user: null,
      token: null,
      error: null,
    });

    renderRoute("/lobby");
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("signs in from user page and enters lobby", async () => {
    const signInAnonymously = vi
      .fn()
      .mockImplementation(async (name: string) => {
        useAuthStore.setState({
          status: "authenticated",
          isHydrated: true,
          user: { id: name, displayName: name },
          token: "token-1",
          error: null,
        });
      });

    useAuthStore.setState({
      status: "idle",
      isHydrated: true,
      user: null,
      token: null,
      error: null,
      signInAnonymously,
    });

    const user = userEvent.setup();
    renderRoute("/user");

    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Nova");
    await user.click(
      screen.getByRole("button", { name: "Sign in anonymously" }),
    );

    expect(signInAnonymously).toHaveBeenCalledWith("Nova");
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("signs out from user page and clears active room state", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const resetMatchConnection = vi.fn().mockResolvedValue(undefined);

    useAuthStore.setState({
      status: "authenticated",
      isHydrated: true,
      user: { id: "helix", displayName: "Helix" },
      token: "token-2",
      error: null,
      signOut,
    });

    useMatchConnectionStore.setState({
      reset: resetMatchConnection,
    });

    const user = userEvent.setup();
    renderRoute("/user");

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(resetMatchConnection).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
