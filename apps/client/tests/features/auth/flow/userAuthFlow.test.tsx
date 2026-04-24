// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserAuthStore } from "#/features/auth/store/userAuthStore";
import { useMatchConnectionStore } from "#/features/match/store/matchConnectionStore";
import AppLayout from "#/routes/_app";
import IndexRoute from "#/routes/_index";
import LobbyRoute from "#/routes/lobby";
import MatchRoute from "#/routes/match.$roomName";
import NotFoundRoute from "#/routes/not-found";
import UserRoute from "#/routes/user";

const initialAuthState = useUserAuthStore.getInitialState();
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
          { path: "match/:roomName", element: <MatchRoute /> },
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
    useUserAuthStore.setState(initialAuthState, true);
    useMatchConnectionStore.setState(initialMatchState, true);
    useUserAuthStore.setState({
      hydrateUser: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects unauthenticated players to user page", async () => {
    useUserAuthStore.setState({
      status: "idle",
      hasHydrated: true,
      displayName: null,
      user: null,
      token: null,
      lastError: null,
    });

    renderRoute("/lobby");
    expect(await screen.findByRole("heading", { name: "User" })).toBeTruthy();
  });

  it("signs in from user page and enters lobby", async () => {
    const signInAnonymously = vi
      .fn()
      .mockImplementation(async (name: string) => {
        useUserAuthStore.setState({
          status: "authenticated",
          hasHydrated: true,
          displayName: name,
          user: { displayName: name },
          token: "token-1",
          lastError: null,
        });
      });

    useUserAuthStore.setState({
      status: "idle",
      hasHydrated: true,
      displayName: null,
      user: null,
      token: null,
      lastError: null,
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

    useUserAuthStore.setState({
      status: "authenticated",
      hasHydrated: true,
      displayName: "Helix",
      user: { displayName: "Helix" },
      token: "token-2",
      lastError: null,
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
