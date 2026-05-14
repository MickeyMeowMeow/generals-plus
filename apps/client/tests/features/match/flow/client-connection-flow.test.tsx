// @vitest-environment jsdom

import { GameMode } from "@generals-plus/engine";
import {
  PLAYER_COLOR_PALETTE,
  QueueClientMessage,
  ROOM_NAMES,
  SetupClientMessage,
  SetupServerMessage,
} from "@generals-plus/shared-types";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStatus } from "#/features/auth/auth-store";
import { createMockAuth } from "#/tests/helpers/auth";
import { renderRoute } from "#/tests/helpers/render";

const networkMocks = vi.hoisted(() => ({
  joinOrCreate: vi.fn(),
  create: vi.fn(),
  joinById: vi.fn(),
  consumeSeatReservation: vi.fn(),
}));

vi.mock("#/infra/network/provider", () => ({
  networkProvider: networkMocks,
}));

function auth() {
  return createMockAuth({
    status: AuthStatus.AUTHENTICATED,
    user: { id: "player-1", displayName: "Nova" },
    token: "token-1",
  });
}

function createState<T>(state: T) {
  return { ...state, clone: () => state };
}

function createRoom({
  roomId = "room-1",
  state,
}: {
  roomId?: string;
  state: unknown;
}) {
  const messageHandlers = new Map<string, (payload: unknown) => void>();
  const room = {
    roomId,
    sessionId: "session-1",
    state,
    send: vi.fn(),
    leave: vi.fn().mockResolvedValue(undefined),
    onStateChange: vi.fn((callback: (nextState: unknown) => void) => {
      callback(state);
      return () => {};
    }),
    onMessage: vi.fn((type: string, callback: (payload: unknown) => void) => {
      messageHandlers.set(type, callback);
      return () => {};
    }),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
    getRecoveryToken: vi.fn().mockReturnValue(null),
    emitMessage(type: string, payload: unknown) {
      messageHandlers.get(type)?.(payload);
    },
  };
  return room;
}

describe("client room flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("joins official classic queue and sends color picks", async () => {
    const queueRoom = createRoom({
      state: createState({
        players: [
          {
            id: "player-1",
            displayName: "Nova",
            color: PLAYER_COLOR_PALETTE[0],
          },
        ],
      }),
    });
    networkMocks.joinOrCreate.mockResolvedValue(queueRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Play Classic/ }));

    expect(
      await screen.findByRole("heading", { name: "Pick your color" }),
    ).toBeTruthy();
    expect(networkMocks.joinOrCreate).toHaveBeenCalledWith(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
    });

    await user.click(
      screen.getByRole("button", {
        name: `Pick color #${PLAYER_COLOR_PALETTE[0]
          .toString(16)
          .padStart(6, "0")}`,
      }),
    );
    expect(queueRoom.send).toHaveBeenCalledWith(QueueClientMessage.PICK_COLOR, {
      color: PLAYER_COLOR_PALETTE[0],
    });
  });

  it("confirms queue seat reservations before entering match", async () => {
    const queueRoom = createRoom({
      state: createState({
        players: [
          {
            id: "player-1",
            displayName: "Nova",
            color: PLAYER_COLOR_PALETTE[0],
          },
        ],
      }),
    });
    const matchRoom = createRoom({ roomId: "match-queue-1", state: {} });
    const reservation = {
      name: ROOM_NAMES.MATCH,
      roomId: "match-queue-1",
      sessionId: "session-1",
    };
    networkMocks.joinOrCreate.mockResolvedValue(queueRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Play Classic/ }));
    await screen.findByRole("heading", { name: "Pick your color" });

    queueRoom.emitMessage("seat", reservation);

    await waitFor(() => {
      expect(queueRoom.send).toHaveBeenCalledWith(QueueClientMessage.CONFIRM);
      expect(networkMocks.consumeSeatReservation).toHaveBeenCalledWith(
        reservation,
      );
    });
  });

  it("creates a custom setup room and navigates into its URL", async () => {
    const setupRoom = createRoom({
      roomId: "setup-123",
      state: createState({
        players: [
          {
            id: "player-1",
            displayName: "Nova",
            color: PLAYER_COLOR_PALETTE[0],
            isHost: true,
          },
        ],
        maxPlayers: 8,
      }),
    });
    networkMocks.create.mockResolvedValue(setupRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Create custom room" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Assemble the room" }),
    ).toBeTruthy();
    expect(networkMocks.create).toHaveBeenCalledWith(ROOM_NAMES.SETUP, {
      gameMode: GameMode.CLASSIC,
      isPublic: false,
    });
  });

  it("joins setup room directly from match URL", async () => {
    const setupRoom = createRoom({
      roomId: "setup-456",
      state: createState({
        players: [
          {
            id: "player-1",
            displayName: "Nova",
            color: PLAYER_COLOR_PALETTE[0],
            isHost: true,
          },
        ],
        maxPlayers: 8,
      }),
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/match/setup-456", auth());

    expect(
      await screen.findByRole("heading", { name: "Assemble the room" }),
    ).toBeTruthy();
    expect(networkMocks.joinById).toHaveBeenCalledWith("setup-456");

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", {
        name: `Pick color #${PLAYER_COLOR_PALETTE[0]
          .toString(16)
          .padStart(6, "0")}`,
      }),
    );
    expect(setupRoom.send).toHaveBeenCalledWith(SetupClientMessage.PICK_COLOR, {
      color: PLAYER_COLOR_PALETTE[0],
    });
  });

  it("consumes seat reservation when setup starts a match", async () => {
    const setupRoom = createRoom({
      roomId: "setup-789",
      state: createState({
        players: [
          {
            id: "player-1",
            displayName: "Nova",
            color: PLAYER_COLOR_PALETTE[0],
            isHost: true,
          },
          {
            id: "player-2",
            displayName: "Rook",
            color: PLAYER_COLOR_PALETTE[1],
            isHost: false,
          },
        ],
        maxPlayers: 8,
      }),
    });
    const matchRoom = createRoom({ roomId: "match-1", state: {} });
    const reservation = {
      name: ROOM_NAMES.MATCH,
      roomId: "match-1",
      sessionId: "session-1",
    };
    networkMocks.joinById.mockResolvedValue(setupRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/match/setup-789", auth());

    await screen.findByRole("heading", { name: "Assemble the room" });
    setupRoom.emitMessage(SetupServerMessage.SEAT_RESERVATION, reservation);

    await waitFor(() => {
      expect(networkMocks.consumeSeatReservation).toHaveBeenCalledWith(
        reservation,
      );
    });
  });

  it("shows a clear error for unavailable custom rooms", async () => {
    networkMocks.joinById.mockRejectedValue(new Error("room not found"));

    renderRoute("/match/missing-room", auth());

    expect(
      await screen.findByRole("heading", { name: "Room unavailable" }),
    ).toBeTruthy();
    expect(screen.getByText(/room not found/)).toBeTruthy();
  });
});
