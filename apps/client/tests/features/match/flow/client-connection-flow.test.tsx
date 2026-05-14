// @vitest-environment jsdom

import { GameMode } from "@generals-plus/engine";
import {
  MatchServerMessage,
  PLAYER_COLOR_PALETTE,
  QueueClientMessage,
  ROOM_NAMES,
  SetupClientMessage,
  SetupServerMessage,
} from "@generals-plus/shared-types";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
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

vi.mock("#/features/game/renderer/game-app", () => ({
  GameApp: () => <div data-testid="game-app" />,
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

function createSetupState(
  players: Array<{
    id: string;
    displayName: string;
    color: number;
    isHost: boolean;
  }>,
) {
  return createState({
    gameMode: GameMode.CLASSIC,
    players,
    maxPlayers: 8,
  });
}

function createMatchState() {
  return {
    mode: GameMode.CLASSIC,
    width: 1,
    height: 1,
    playerColors: new Map([
      ["player-1", PLAYER_COLOR_PALETTE[0]],
      ["player-2", PLAYER_COLOR_PALETTE[1]],
    ]),
    clientVisions: new Map([
      [
        "session-1",
        {
          terrain: ["plain"],
          troopCount: [5],
          visibility: ["visible"],
          ownerIndex: ["player-1"],
        },
      ],
    ]),
    clientActionQueues: new Map([["session-1", { queue: [] }]]),
    players: new Map([
      [
        "player-1",
        {
          id: "player-1",
          displayName: "Nova",
          teamId: "team_0",
          color: PLAYER_COLOR_PALETTE[0],
          sessionId: "session-1",
        },
      ],
      [
        "player-2",
        {
          id: "player-2",
          displayName: "Rook",
          teamId: "team_1",
          color: PLAYER_COLOR_PALETTE[1],
          sessionId: "session-2",
        },
      ],
    ]),
    scoreboard: {
      mode: GameMode.CLASSIC,
      players: [
        { playerId: "player-1", land: 3, troops: 7 },
        { playerId: "player-2", land: 4, troops: 12 },
      ],
    },
  };
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
    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(
      await screen.findByRole("dialog", { name: "Choose mode" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Demolition/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Classic/ }));

    expect(await screen.findByRole("heading", { name: "Color" })).toBeTruthy();
    expect(screen.getByText("Mode: Classic")).toBeTruthy();
    expect(screen.getByText("Nova").closest("li")).toHaveClass("font-semibold");
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
    const matchRoom = createRoom({
      roomId: "match-queue-1",
      state: createMatchState(),
    });
    const reservation = {
      name: ROOM_NAMES.MATCH,
      roomId: "match-queue-1",
      sessionId: "session-1",
    };
    networkMocks.joinOrCreate.mockResolvedValue(queueRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(await screen.findByRole("button", { name: /Classic/ }));
    await screen.findByRole("heading", { name: "Color" });

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
      state: createSetupState([
        {
          id: "player-1",
          displayName: "Nova",
          color: PLAYER_COLOR_PALETTE[0],
          isHost: true,
        },
      ]),
    });
    networkMocks.create.mockResolvedValue(setupRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Create custom room" }),
    );

    expect(await screen.findByText("You are host")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Force start game" }),
    ).toBeNull();
    expect(networkMocks.create).toHaveBeenCalledWith(ROOM_NAMES.SETUP, {
      gameMode: GameMode.CLASSIC,
      isPublic: false,
    });
  });

  it("joins setup room directly from match URL", async () => {
    const setupRoom = createRoom({
      roomId: "setup-456",
      state: createSetupState([
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
      ]),
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/match/setup-456", auth());

    expect(await screen.findByText("You are host")).toBeTruthy();
    expect(networkMocks.joinById).toHaveBeenCalledWith("setup-456");
    const modeSelect = screen.getByLabelText("Game mode");
    expect(modeSelect).toBeTruthy();
    expect(
      within(modeSelect).getByRole("option", { name: /Demolition/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Force start game" }),
    ).toBeTruthy();

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

    await user.click(screen.getByRole("button", { name: "Force start game" }));
    expect(setupRoom.send).toHaveBeenCalledWith(SetupClientMessage.START_GAME);
  });

  it("consumes seat reservation when setup starts a match", async () => {
    const setupRoom = createRoom({
      roomId: "setup-789",
      state: createSetupState([
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
      ]),
    });
    const matchRoom = createRoom({
      roomId: "match-1",
      state: createMatchState(),
    });
    const reservation = {
      name: ROOM_NAMES.MATCH,
      roomId: "match-1",
      sessionId: "session-1",
    };
    networkMocks.joinById.mockResolvedValue(setupRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/match/setup-789", auth());

    await screen.findByText("You are host");
    setupRoom.emitMessage(SetupServerMessage.SEAT_RESERVATION, reservation);

    await waitFor(() => {
      expect(networkMocks.consumeSeatReservation).toHaveBeenCalledWith(
        reservation,
      );
    });
  });

  it("shows match results and returns custom games to the same setup URL", async () => {
    const setupRoom = createRoom({
      roomId: "setup-result",
      state: createSetupState([
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
      ]),
    });
    const matchRoom = createRoom({
      roomId: "match-result",
      state: createMatchState(),
    });
    const reservation = {
      name: ROOM_NAMES.MATCH,
      roomId: "match-result",
      sessionId: "session-1",
    };
    networkMocks.joinById.mockResolvedValue(setupRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/match/setup-result", auth());

    await screen.findByText("You are host");
    setupRoom.emitMessage(SetupServerMessage.SEAT_RESERVATION, reservation);
    await screen.findByTestId("game-app");

    matchRoom.emitMessage(MatchServerMessage.GAME_END, {
      mode: GameMode.CLASSIC,
      winnerTeamId: "team_1",
    });

    expect(
      await screen.findByRole("dialog", { name: "You lost" }),
    ).toBeTruthy();
    expect(screen.getByText("Winner: Rook")).toBeTruthy();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Return to setup room" }),
    );

    expect(await screen.findByText("You are host")).toBeTruthy();
    expect(networkMocks.joinById).toHaveBeenCalledTimes(1);
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
