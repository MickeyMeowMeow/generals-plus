// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserAuthStore } from "#/features/auth/store/userAuthStore";
import { useMatchConnectionStore } from "#/features/match/store/matchConnectionStore";
import AppLayout from "#/routes/_app";
import IndexRoute from "#/routes/_index";
import LobbyRoute from "#/routes/lobby";
import MatchRoute from "#/routes/match.$roomId";
import NotFoundRoute from "#/routes/not-found";
import UserRoute from "#/routes/user";

const initialMatchState = useMatchConnectionStore.getInitialState();
const initialAuthState = useUserAuthStore.getInitialState();

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

describe("client connection flow", () => {
  beforeEach(() => {
    useMatchConnectionStore.setState(initialMatchState, true);
    useUserAuthStore.setState(initialAuthState, true);
    useUserAuthStore.setState({
      hydrateUser: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("calls connect action from lobby", async () => {
    const connect = vi.fn();

    useUserAuthStore.setState({
      status: "authenticated",
      hasHydrated: true,
      displayName: "Scout",
      user: { name: "Scout" },
      token: "token-scout",
      lastError: null,
    });

    useMatchConnectionStore.setState({
      connect,
      joinRoom: vi.fn(),
      setError: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
      status: "idle",
      roomId: null,
      roomName: null,
      sessionId: null,
      latestState: null,
      latestMessage: null,
      lastError: null,
    });

    const user = userEvent.setup();
    renderRoute("/lobby");

    await user.click(screen.getByRole("button", { name: "Init connection" }));

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

    useUserAuthStore.setState({
      status: "authenticated",
      hasHydrated: true,
      displayName: "Rogue",
      user: { displayName: "Rogue" },
      token: "token-rogue",
      lastError: null,
    });

    useMatchConnectionStore.setState({
      connect: vi.fn(),
      joinRoom,
      setError: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
      status: "disconnected",
      roomId: null,
      roomName: null,
      sessionId: null,
      latestState: null,
      latestMessage: null,
      lastError: null,
    });

    const user = userEvent.setup();
    renderRoute("/lobby");

    const input = screen.getByLabelText("Room name");
    await user.clear(input);
    await user.type(input, "alpha-room");
    await user.click(screen.getByRole("button", { name: "Join room" }));

    expect(joinRoom).toHaveBeenCalledWith("alpha-room", {
      user: {
        displayName: "Rogue",
      },
    });
    expect(await screen.findByText("Room ID: room-123")).toBeTruthy();
  });

  it("leaves room when match page unmounts", async () => {
    const leaveRoom = vi.fn().mockResolvedValue(undefined);

    useUserAuthStore.setState({
      status: "authenticated",
      hasHydrated: true,
      displayName: "Scout",
      user: { name: "Scout" },
      token: "token-scout",
      lastError: null,
    });

    useMatchConnectionStore.setState({
      connect: vi.fn(),
      joinRoom: vi.fn().mockResolvedValue(undefined),
      setError: vi.fn(),
      leaveRoom,
      status: "connected",
      roomId: "room-9",
      roomName: "alpha-room",
      sessionId: "session-9",
      latestState: { hp: 10 },
      latestMessage: null,
      lastError: null,
    });

    const view = renderRoute("/match/room-9");

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

    useUserAuthStore.setState({
      status: "authenticated",
      hasHydrated: true,
      displayName: "Cipher",
      user: { name: "Cipher" },
      token: "token-cipher",
      lastError: null,
    });

    useMatchConnectionStore.setState({
      connect: vi.fn(),
      joinRoom,
      setError: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
      status: "disconnected",
      roomId: null,
      roomName: null,
      sessionId: null,
      latestState: null,
      latestMessage: null,
      lastError: null,
    });

    const user = userEvent.setup();
    renderRoute("/lobby");

    await user.type(
      screen.getByLabelText("Room access code (optional)"),
      "abc123",
    );
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
