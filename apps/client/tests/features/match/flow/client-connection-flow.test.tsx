// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

/** Creates a mock {@link AuthContextValue} with authenticated defaults. */
function createMockAuth(
  overrides: Partial<AuthContextValue["state"]> = {},
): AuthContextValue {
  return {
    state: {
      status: "authenticated",
      isHydrated: true,
      user: { id: "scout", displayName: "Scout" },
      token: "token-scout",
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

describe("client connection flow", () => {
  let auth: AuthContextValue;

  beforeEach(() => {
    auth = createMockAuth();
    useMatchConnectionStore.setState(initialMatchState, true);
  });

  afterEach(() => {
    cleanup();
  });

  it("calls connect action from lobby", async () => {
    const connect = vi.fn();

    useMatchConnectionStore.setState({
      connect,
      joinRoom: vi.fn(),
      joinById: vi.fn(),
      reconnect: vi.fn().mockResolvedValue(undefined),
      setError: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
      status: "idle",
      roomId: null,
      roomName: null,
      sessionId: null,
      reconnectionToken: null,
      isReconnecting: false,
      lastError: null,
      getRoom: () => null,
    });

    const user = userEvent.setup();
    renderRoute("/lobby", auth);

    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("joins room from lobby and navigates to match route", async () => {
    const joinRoom = vi.fn().mockImplementation(async (roomName: string) => {
      useMatchConnectionStore.setState({
        status: "connected",
        roomName: roomName,
        roomId: "room-123",
        sessionId: "session-123",
      });
    });

    auth = createMockAuth({
      user: { id: "rogue", displayName: "Rogue" },
      token: "token-rogue",
    });

    useMatchConnectionStore.setState({
      connect: vi.fn(),
      joinRoom,
      joinById: vi.fn(),
      reconnect: vi.fn().mockResolvedValue(undefined),
      setError: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
      status: "disconnected",
      roomId: null,
      roomName: null,
      sessionId: null,
      reconnectionToken: null,
      isReconnecting: false,
      lastError: null,
      getRoom: () => null,
    });

    const user = userEvent.setup();
    renderRoute("/lobby", auth);

    const input = screen.getByLabelText("Room name");
    await user.clear(input);
    await user.type(input, "alpha-room");
    await user.click(screen.getByRole("button", { name: "Join room" }));

    expect(joinRoom).toHaveBeenCalledWith("alpha-room", {
      user: {
        displayName: "Rogue",
      },
    });
    expect(
      await screen.findByRole("heading", { name: "Match Room" }),
    ).toBeTruthy();
  });

  it("leaves room when match page unmounts", async () => {
    const leaveRoom = vi.fn().mockResolvedValue(undefined);

    useMatchConnectionStore.setState({
      connect: vi.fn(),
      joinRoom: vi.fn().mockResolvedValue(undefined),
      joinById: vi.fn().mockResolvedValue(undefined),
      reconnect: vi.fn().mockResolvedValue(undefined),
      setError: vi.fn(),
      leaveRoom,
      status: "connected",
      roomId: "room-9",
      roomName: "alpha-room",
      sessionId: "session-9",
      reconnectionToken: "room-9:token",
      isReconnecting: false,
      lastError: null,
      getRoom: () => null,
    });

    const view = renderRoute("/match/room-9", auth);

    expect(
      await screen.findByRole("heading", { name: "Match Room" }),
    ).toBeTruthy();

    view.unmount();

    await waitFor(() => {
      expect(leaveRoom).toHaveBeenCalled();
    });
  });

  it("sends room access code when provided", async () => {
    const joinRoom = vi.fn().mockResolvedValue(undefined);

    auth = createMockAuth({
      user: { id: "cipher", displayName: "Cipher" },
      token: "token-cipher",
    });

    useMatchConnectionStore.setState({
      connect: vi.fn(),
      joinRoom,
      joinById: vi.fn(),
      reconnect: vi.fn().mockResolvedValue(undefined),
      setError: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
      status: "disconnected",
      roomId: null,
      roomName: null,
      sessionId: null,
      reconnectionToken: null,
      isReconnecting: false,
      lastError: null,
      getRoom: () => null,
    });

    const user = userEvent.setup();
    renderRoute("/lobby", auth);

    await user.type(screen.getByLabelText("Access code (optional)"), "abc123");
    await user.click(screen.getByRole("button", { name: "Join room" }));

    expect(joinRoom).toHaveBeenCalledWith("skirmish-room", {
      user: {
        displayName: "Cipher",
      },
      roomAuth: {
        accessCode: "abc123",
      },
    });
  });
});
