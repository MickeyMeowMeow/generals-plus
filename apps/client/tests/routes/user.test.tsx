// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStatus } from "#/features/auth/auth-store";
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

describe("user route", () => {
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

  it("renders user page with sign-in form", () => {
    useAuthStore.setState({
      status: AuthStatus.IDLE,
      isHydrated: true,
      user: null,
      token: null,
      error: null,
    });

    renderRoute("/user");

    expect(screen.getByRole("heading", { name: "Sign In" })).toBeTruthy();
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Sign in anonymously" }),
    ).toBeTruthy();
  });

  it("shows default display name in input", () => {
    useAuthStore.setState({
      status: "idle",
      isHydrated: true,
    });

    renderRoute("/user");

    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");
  });

  it("disables sign-in button while authenticating", () => {
    useAuthStore.setState({
      status: AuthStatus.AUTHENTICATING,
      isHydrated: true,
    });

    renderRoute("/user");

    expect(
      (
        screen.getByRole("button", {
          name: "Signing in...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("displays error message when auth fails", () => {
    useAuthStore.setState({
      status: "error",
      isHydrated: true,
      error: "Network error",
    });

    renderRoute("/user");

    expect(screen.getByRole("alert").textContent).toContain("Network error");
  });

  it("shows active player name when authenticated", () => {
    useAuthStore.setState({
      status: AuthStatus.AUTHENTICATED,
      isHydrated: true,
      user: { id: "nova", displayName: "Nova" },
      token: "tok",
      error: null,
    });

    renderRoute("/user");

    expect(screen.getByText("Nova")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter lobby" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("navigates to lobby when clicking Enter lobby button", async () => {
    useAuthStore.setState({
      status: AuthStatus.AUTHENTICATED,
      isHydrated: true,
      user: { id: "scout", displayName: "Scout" },
      token: "tok",
      error: null,
    });

    const user = userEvent.setup();
    renderRoute("/user");

    await user.click(screen.getByRole("button", { name: "Enter lobby" }));
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("updates display name input on typing", async () => {
    useAuthStore.setState({
      status: AuthStatus.IDLE,
      isHydrated: true,
    });

    const user = userEvent.setup();
    renderRoute("/user");

    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Ace");

    expect((input as HTMLInputElement).value).toBe("Ace");
  });

  it("clears match connection and signs out on sign-out click", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const resetMatchConnection = vi.fn().mockResolvedValue(undefined);

    useAuthStore.setState({
      status: AuthStatus.AUTHENTICATED,
      isHydrated: true,
      user: { id: "helix", displayName: "Helix" },
      token: "tok",
      error: null,
      signOut,
    });
    useMatchConnectionStore.setState({ reset: resetMatchConnection });

    const user = userEvent.setup();
    renderRoute("/user");

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(resetMatchConnection).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
