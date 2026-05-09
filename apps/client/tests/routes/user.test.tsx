// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "#/features/auth/auth-store";
import { AuthStatus } from "#/features/auth/auth-store";
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
      status: AuthStatus.IDLE,
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

describe("user route", () => {
  let auth: AuthContextValue;

  beforeEach(() => {
    auth = createMockAuth();
    useMatchConnectionStore.setState(initialMatchState, true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders user page with sign-in form", () => {
    renderRoute("/user", auth);

    expect(screen.getByRole("heading", { name: "Sign In" })).toBeTruthy();
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Sign in anonymously" }),
    ).toBeTruthy();
  });

  it("shows default display name in input", () => {
    renderRoute("/user", auth);

    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");
  });

  it("disables sign-in button while authenticating", () => {
    auth = createMockAuth({ status: AuthStatus.AUTHENTICATING });

    renderRoute("/user", auth);

    expect(
      (
        screen.getByRole("button", {
          name: "Signing in...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("displays error message when auth fails", () => {
    auth = createMockAuth({ status: "error", error: "Network error" });

    renderRoute("/user", auth);

    expect(screen.getByRole("alert").textContent).toContain("Network error");
  });

  it("shows active player name when authenticated", () => {
    auth = createMockAuth({
      status: AuthStatus.AUTHENTICATED,
      user: { id: "nova", displayName: "Nova" },
      token: "tok",
    });

    renderRoute("/user", auth);

    expect(screen.getByText("Nova")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter lobby" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("navigates to lobby when clicking Enter lobby button", async () => {
    auth = createMockAuth({
      status: AuthStatus.AUTHENTICATED,
      user: { id: "scout", displayName: "Scout" },
      token: "tok",
    });

    const user = userEvent.setup();
    renderRoute("/user", auth);

    await user.click(screen.getByRole("button", { name: "Enter lobby" }));
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("updates display name input on typing", async () => {
    const user = userEvent.setup();
    renderRoute("/user", auth);

    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Ace");

    expect((input as HTMLInputElement).value).toBe("Ace");
  });

  it("clears match connection and signs out on sign-out click", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const resetMatchConnection = vi.fn().mockResolvedValue(undefined);

    auth = createMockAuth({
      status: AuthStatus.AUTHENTICATED,
      user: { id: "helix", displayName: "Helix" },
      token: "tok",
    });
    auth.actions.signOut = signOut;
    useMatchConnectionStore.setState({ reset: resetMatchConnection });

    const user = userEvent.setup();
    renderRoute("/user", auth);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(resetMatchConnection).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
