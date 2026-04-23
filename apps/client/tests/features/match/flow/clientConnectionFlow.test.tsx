// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appRoutes } from "../../../../src/features/common/router";
import { useMatchConnectionStore } from "../../../../src/features/match/store/matchConnectionStore";

const initialState = useMatchConnectionStore.getInitialState();

function renderRoute(initialPath: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath],
  });

  return render(<RouterProvider router={router} />);
}

describe("client connection flow", () => {
  beforeEach(() => {
    useMatchConnectionStore.setState(initialState, true);
  });

  afterEach(() => {
    cleanup();
  });

  it("calls connect action from lobby", async () => {
    const connect = vi.fn();

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
        roomName,
        roomId: "room-123",
        sessionId: "session-123",
      });
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

    expect(joinRoom).toHaveBeenCalledWith("alpha-room");
    expect(await screen.findByText("Room: alpha-room")).toBeTruthy();
  });

  it("leaves room when match page unmounts", async () => {
    const leaveRoom = vi.fn().mockResolvedValue(undefined);

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

    const view = renderRoute("/match/alpha-room");

    expect(
      await screen.findByRole("heading", { name: "Match Room" }),
    ).toBeTruthy();

    view.unmount();

    await waitFor(() => {
      expect(leaveRoom).toHaveBeenCalled();
    });
  });
});
