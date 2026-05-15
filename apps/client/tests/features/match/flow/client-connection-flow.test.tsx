// @vitest-environment jsdom

import { GameMode } from "@generals-plus/engine";
import type { SetupSettings } from "@generals-plus/shared-types";
import {
  MatchServerMessage,
  PLAYER_COLOR_PALETTE,
  QueueClientMessage,
  ROOM_NAMES,
  SetupClientMessage,
  SetupServerMessage,
} from "@generals-plus/shared-types";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStatus } from "#/features/auth/auth-store";
import { AuthContext } from "#/features/auth/providers/auth-provider";
import { resetGameConnectionsForTesting } from "#/features/game/api/use-game-room";
import { resetQueueConnectionsForTesting } from "#/features/game/api/use-queue-room";
import { resetSetupConnectionsForTesting } from "#/features/game/api/use-setup-room";
import { QueuePage } from "#/features/game/pages/queue-page";
import { createMockAuth } from "#/tests/helpers/auth";
import { renderRoute } from "#/tests/helpers/render";

const networkMocks = vi.hoisted(() => ({
  joinOrCreate: vi.fn(),
  create: vi.fn(),
  joinById: vi.fn(),
  consumeSeatReservation: vi.fn(),
  restoreSession: vi.fn(),
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
  overrides: Partial<SetupSettings> = {},
) {
  const settings: SetupSettings = {
    gameMode: GameMode.CLASSIC,
    isPublic: false,
    maxPlayers: 8,
    playersPerTeam: 2,
    mapWidth: 24,
    mapHeight: 16,
    seed: 0,
    mountainRate: 0.12,
    cityRate: 0.06,
    minGeneralDistanceFactor: 0.6,
    generalInitialTroops: 50,
    cityInitialTroops: 50,
    ...overrides,
  };

  return createState({
    ...settings,
    players,
  });
}

function createMatchState() {
  return {
    mode: GameMode.CLASSIC,
    width: 1,
    height: 1,
    publicPlayers: new Map([
      [
        "player-1",
        {
          id: "player-1",
          displayName: "Nova",
          teamId: "team_0",
          color: PLAYER_COLOR_PALETTE[0],
        },
      ],
      [
        "player-2",
        {
          id: "player-2",
          displayName: "Rook",
          teamId: "team_1",
          color: PLAYER_COLOR_PALETTE[1],
        },
      ],
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
  currentState = state,
  emitInitialState = true,
  recoveryToken = null,
}: {
  roomId?: string;
  state: unknown;
  currentState?: unknown;
  emitInitialState?: boolean;
  recoveryToken?: string | null;
}) {
  const messageHandlers = new Map<string, (payload: unknown) => void>();
  const stateHandlers = new Set<(nextState: unknown) => void>();
  const room = {
    roomId,
    sessionId: "session-1",
    state: currentState,
    send: vi.fn(),
    leave: vi.fn().mockResolvedValue(undefined),
    onStateChange: vi.fn((callback: (nextState: unknown) => void) => {
      stateHandlers.add(callback);
      if (emitInitialState) {
        callback(state);
      }
      return () => stateHandlers.delete(callback);
    }),
    onMessage: vi.fn((type: string, callback: (payload: unknown) => void) => {
      messageHandlers.set(type, callback);
      return () => {};
    }),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
    getRecoveryToken: vi.fn().mockReturnValue(recoveryToken),
    emitState(nextState: unknown) {
      room.state = nextState;
      for (const callback of stateHandlers) {
        callback(nextState);
      }
    },
    emitMessage(type: string, payload: unknown) {
      messageHandlers.get(type)?.(payload);
    },
  };
  return room;
}

describe("client room flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetGameConnectionsForTesting();
    resetQueueConnectionsForTesting();
    resetSetupConnectionsForTesting();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

    expect(
      await screen.findByRole("heading", { name: "Pick Your Color" }),
    ).toBeTruthy();
    expect(screen.getByText("Mode: Classic")).toBeTruthy();
    expect(screen.getByText("Mode: Classic")).toBeTruthy();
    const usernameInList = screen
      .getAllByText("Nova")
      .find((el) => el.closest("li"));
    expect(usernameInList!.closest("li")).toHaveClass("font-semibold");
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

  it("deduplicates official queue joins across StrictMode remounts", async () => {
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

    render(
      <AuthContext.Provider value={auth()}>
        <StrictMode>
          <QueuePage gameMode={GameMode.CLASSIC} onLeave={vi.fn()} />
        </StrictMode>
      </AuthContext.Provider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Pick Your Color" }),
    ).toBeTruthy();
    expect(networkMocks.joinOrCreate).toHaveBeenCalledTimes(1);
    expect(networkMocks.joinOrCreate).toHaveBeenCalledWith(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
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
    await screen.findByRole("heading", { name: "Pick Your Color" });

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

  it("renders custom setup state when the initial room patch arrived before navigation", async () => {
    const setupRoom = createRoom({
      roomId: "setup-cached",
      emitInitialState: false,
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
    expect(screen.queryByText("Joining custom room")).toBeNull();
  });

  it("joins setup room directly from match URL", async () => {
    const setupRoom = createRoom({
      roomId: "setup-456",
      state: createSetupState(
        [
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
        { playersPerTeam: 1 },
      ),
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/match/setup-456", auth());

    expect(await screen.findByText("You are host")).toBeTruthy();
    expect(networkMocks.joinById).toHaveBeenCalledWith("setup-456");
    const user = userEvent.setup();
    const modeSelect = screen.getByLabelText("Game mode");
    expect(modeSelect).toBeTruthy();
    fireEvent.keyDown(modeSelect, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /Demolition/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.keyDown(modeSelect, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "Force start game" }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Max Players"), {
      target: { value: "6" },
    });
    await user.click(screen.getByRole("button", { name: "Apply Changes" }));
    expect(setupRoom.send).toHaveBeenCalledWith(
      SetupClientMessage.UPDATE_SETTINGS,
      expect.objectContaining({ maxPlayers: 6 }),
    );

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

  it("does not allow a custom match to start when all players are on one team", async () => {
    const setupRoom = createRoom({
      roomId: "setup-one-team",
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

    renderRoute("/match/setup-one-team", auth());

    expect(await screen.findByText("You are host")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Force start game" }),
    ).toBeNull();
    expect(screen.getByText(/at least two teams/)).toBeTruthy();
  });

  it("waits for a complete setup state when joining a custom room by link", async () => {
    const readyState = createSetupState([
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
    ]);
    const setupRoom = createRoom({
      roomId: "setup-delayed",
      currentState: createState({}),
      emitInitialState: false,
      state: readyState,
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/match/setup-delayed", auth());

    expect(await screen.findByText("Joining custom room")).toBeTruthy();

    setupRoom.emitState(readyState);

    expect(await screen.findByText("You are host")).toBeTruthy();
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

  it("does not surrender by leaving the match room during UI cleanup", async () => {
    const setupRoom = createRoom({
      roomId: "setup-cleanup",
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
      roomId: "match-cleanup",
      state: createMatchState(),
    });
    const reservation = {
      name: ROOM_NAMES.MATCH,
      roomId: "match-cleanup",
      sessionId: "session-1",
    };
    networkMocks.joinById.mockResolvedValue(setupRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/match/setup-cleanup", auth());

    await screen.findByText("You are host");
    setupRoom.emitMessage(SetupServerMessage.SEAT_RESERVATION, reservation);
    await screen.findByTestId("game-app");

    vi.useFakeTimers();
    cleanup();
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(matchRoom.leave).not.toHaveBeenCalled();
  });

  it("restores an official match after refreshing on the root route", async () => {
    const matchRoom = createRoom({
      roomId: "match-refresh",
      state: createMatchState(),
    });
    networkMocks.restoreSession.mockResolvedValue(matchRoom);
    localStorage.setItem(
      "generals_plus_active_game_session",
      JSON.stringify({
        recoveryToken: "official-token",
        source: { type: "official" },
      }),
    );

    renderRoute("/", auth());

    expect(await screen.findByTestId("game-app")).toBeTruthy();
    expect(networkMocks.restoreSession).toHaveBeenCalledWith("official-token");
  });

  it("restores a custom match after refreshing its setup URL", async () => {
    const matchRoom = createRoom({
      roomId: "match-custom-refresh",
      state: createMatchState(),
    });
    networkMocks.restoreSession.mockResolvedValue(matchRoom);
    localStorage.setItem(
      "generals_plus_active_game_session",
      JSON.stringify({
        recoveryToken: "custom-token",
        source: { type: "custom", setupRoomId: "setup-refresh" },
      }),
    );

    renderRoute("/match/setup-refresh", auth());

    expect(await screen.findByTestId("game-app")).toBeTruthy();
    expect(networkMocks.restoreSession).toHaveBeenCalledWith("custom-token");
    expect(networkMocks.joinById).not.toHaveBeenCalled();
  });

  it("shows a lobby escape when a persisted match recovery token is stale", async () => {
    networkMocks.restoreSession.mockRejectedValue(new Error("room not found"));
    localStorage.setItem(
      "generals_plus_active_game_session",
      JSON.stringify({
        recoveryToken: "stale-token",
        source: { type: "custom", setupRoomId: "setup-stale" },
      }),
    );

    renderRoute("/match/setup-stale", auth());

    expect(
      await screen.findByRole("heading", { name: "Connection failed" }),
    ).toBeTruthy();
    expect(screen.getByText(/room not found/)).toBeTruthy();
    expect(
      localStorage.getItem("generals_plus_active_game_session"),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Return to lobby" }));

    expect(await screen.findByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("stops waiting when persisted match recovery never resolves", async () => {
    vi.useFakeTimers();
    networkMocks.restoreSession.mockReturnValue(new Promise(() => {}));
    localStorage.setItem(
      "generals_plus_active_game_session",
      JSON.stringify({
        recoveryToken: "hung-token",
        source: { type: "official" },
      }),
    );

    renderRoute("/", auth());

    expect(screen.getByText("Connecting to match")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "Connection failed" }),
    ).toBeTruthy();
    expect(screen.getByText(/Unable to restore the match/)).toBeTruthy();
    expect(
      localStorage.getItem("generals_plus_active_game_session"),
    ).toBeNull();
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
