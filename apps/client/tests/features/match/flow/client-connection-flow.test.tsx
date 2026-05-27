// @vitest-environment jsdom

import { GameMode, GridType } from "@generals-plus/engine";
import type { SetupSettings } from "@generals-plus/shared-types";
import {
  CUSTOM_ROOM_KEY_MAX_LENGTH,
  CUSTOM_ROOM_KEY_MIN_LENGTH,
  MatchClientMessage,
  MatchServerMessage,
  PLAYER_COLOR_PALETTE,
  QueueClientMessage,
  QueueServerMessage,
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
import { HttpRequestError } from "#/infra/network/provider/colyseus";
import { RoomStatus } from "#/infra/network/room";
import { createMockAuth } from "#/tests/helpers/auth";
import { renderRoute } from "#/tests/helpers/render";

const networkMocks = vi.hoisted(() => ({
  joinOrCreate: vi.fn(),
  create: vi.fn(),
  createCustomRoom: vi.fn(),
  joinById: vi.fn(),
  resolveCustomRoom: vi.fn(),
  consumeSeatReservation: vi.fn(),
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("#/infra/network/provider", () => ({
  networkProvider: networkMocks,
}));

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner");
  return {
    ...actual,
    toast: {
      ...actual.toast,
      ...toastMock,
    },
  };
});

vi.mock("#/features/game/renderer/game-app", () => ({
  GameApp: ({ onClearMoveQueue }: { onClearMoveQueue: () => void }) => (
    <button data-testid="game-app" type="button" onClick={onClearMoveQueue}>
      Game app
    </button>
  ),
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
  const settings = {
    gameMode: GameMode.CLASSIC,
    isPublic: false,
    maxPlayers: 8,
    playersPerTeam: 1,
    mapType: GridType.SQUARE,
    mapWidth: 24,
    mapHeight: 16,
    seed: 0,
    mountainRate: 0.12,
    cityRate: 0.06,
    minGeneralDistanceFactor: 0.6,
    generalInitialTroops: 50,
    cityInitialTroops: 50,
    speed: 1,
    ...overrides,
  } as SetupSettings;

  return createState({
    ...settings,
    players,
  });
}

function createMatchState() {
  return {
    mode: GameMode.CLASSIC,
    gridType: GridType.SQUARE,
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
          cells: [
            {
              terrain: "plain",
              troopCount: 5,
              visibility: "visible",
              ownerIndex: "player-1",
            },
          ],
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
  const statusHandlers = new Set<(status: string, details?: string) => void>();
  const errorHandlers = new Set<(code: number, message?: string) => void>();
  const leaveHandlers = new Set<(code: number, reason?: string) => void>();
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
    onStatusChange: vi.fn(
      (callback: (status: string, details?: string) => void) => {
        statusHandlers.add(callback);
        return () => statusHandlers.delete(callback);
      },
    ),
    getRecoveryToken: vi.fn().mockReturnValue(recoveryToken),
    onError: vi.fn((callback: (code: number, message?: string) => void) => {
      errorHandlers.add(callback);
      return () => errorHandlers.delete(callback);
    }),
    onLeave: vi.fn((callback: (code: number, reason?: string) => void) => {
      leaveHandlers.add(callback);
      return () => leaveHandlers.delete(callback);
    }),
    emitState(nextState: unknown) {
      room.state = nextState;
      for (const callback of stateHandlers) {
        callback(nextState);
      }
    },
    emitMessage(type: string, payload: unknown) {
      messageHandlers.get(type)?.(payload);
    },
    emitStatus(status: string, details?: string) {
      for (const callback of statusHandlers) {
        callback(status, details);
      }
    },
    emitError(code: number, message?: string) {
      for (const callback of errorHandlers) {
        callback(code, message);
      }
    },
    emitLeave(code: number, reason?: string) {
      for (const callback of leaveHandlers) {
        callback(code, reason);
      }
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
    toastMock.warning.mockReset();
    networkMocks.resolveCustomRoom.mockImplementation(
      async (customRoomKey: string) => ({
        customRoomKey,
        setupRoomId: customRoomKey,
        created: false,
      }),
    );
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
    expect(usernameInList?.closest("li")).toHaveClass("font-semibold");
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

  it("shows the elapsed queue time at the bottom of the official queue page", async () => {
    vi.useFakeTimers();
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
        <QueuePage gameMode={GameMode.CLASSIC} onLeave={vi.fn()} />
      </AuthContext.Provider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("00:00")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByText("00:03")).toBeTruthy();
  });

  it("keeps queue time running across queue-state updates", async () => {
    vi.useFakeTimers();
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
        <QueuePage gameMode={GameMode.CLASSIC} onLeave={vi.fn()} />
      </AuthContext.Provider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });

    act(() => {
      queueRoom.emitState(
        createState({
          players: [
            {
              id: "player-1",
              displayName: "Nova",
              color: PLAYER_COLOR_PALETTE[1],
            },
            {
              id: "player-2",
              displayName: "Rook",
              color: PLAYER_COLOR_PALETTE[0],
            },
          ],
        }),
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText("00:03")).toBeTruthy();
  });

  it("leaves the official queue when the queue room disconnects", async () => {
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
    const onLeave = vi.fn();
    networkMocks.joinOrCreate.mockResolvedValue(queueRoom);

    render(
      <AuthContext.Provider value={auth()}>
        <QueuePage gameMode={GameMode.CLASSIC} onLeave={onLeave} />
      </AuthContext.Provider>,
    );

    await screen.findByRole("heading", { name: "Pick Your Color" });

    act(() => {
      queueRoom.emitStatus(RoomStatus.DISCONNECTED, "connection lost");
    });

    expect(onLeave).toHaveBeenCalledTimes(1);
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
    networkMocks.createCustomRoom.mockResolvedValue({
      customRoomKey: "custom-123",
      setupRoomId: "setup-123",
      created: true,
    });
    networkMocks.resolveCustomRoom.mockResolvedValue({
      customRoomKey: "custom-123",
      setupRoomId: "setup-123",
      created: false,
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Create/Join custom room" }),
    );

    expect(await screen.findByText("You are host")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Force start game" }),
    ).toBeNull();
    expect(networkMocks.createCustomRoom).toHaveBeenCalledTimes(1);
    expect(networkMocks.resolveCustomRoom).toHaveBeenCalledWith("custom-123");
    expect(networkMocks.joinById).toHaveBeenCalledWith("setup-123");
  });

  it("joins an existing custom setup room when creating the same lobby room id conflicts", async () => {
    const setupRoom = createRoom({
      roomId: "setup-join-existing",
      state: createSetupState([
        {
          id: "player-1",
          displayName: "Nova",
          color: PLAYER_COLOR_PALETTE[0],
          isHost: false,
        },
        {
          id: "player-2",
          displayName: "Rook",
          color: PLAYER_COLOR_PALETTE[1],
          isHost: true,
        },
      ]),
    });
    networkMocks.createCustomRoom.mockRejectedValue(
      new HttpRequestError(409, "room already exists"),
    );
    networkMocks.resolveCustomRoom.mockResolvedValue({
      customRoomKey: "existing-room",
      setupRoomId: "setup-join-existing",
      created: false,
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Custom room id" }),
      "existing-room",
    );
    await user.click(
      screen.getByRole("button", { name: "Create/Join custom room" }),
    );

    expect(await screen.findByText("You are guest")).toBeTruthy();
    expect(networkMocks.createCustomRoom).toHaveBeenCalledWith("existing-room");
    expect(networkMocks.resolveCustomRoom).toHaveBeenCalledWith(
      "existing-room",
    );
    expect(networkMocks.joinById).toHaveBeenCalledWith("setup-join-existing");
  });

  it("shows a validation error when the lobby custom room id is too short or too long", async () => {
    renderRoute("/", auth());

    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: "Custom room id" });
    const button = screen.getByRole("button", {
      name: "Create/Join custom room",
    });

    await user.type(input, "abc");
    await user.click(button);

    expect(
      screen.getByText(
        `Room id must be ${CUSTOM_ROOM_KEY_MIN_LENGTH} - ${CUSTOM_ROOM_KEY_MAX_LENGTH} characters.`,
      ),
    ).toBeTruthy();
    expect(networkMocks.createCustomRoom).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "abcdefghijklmnopq");
    await user.click(button);

    expect(networkMocks.createCustomRoom).not.toHaveBeenCalled();
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
    networkMocks.createCustomRoom.mockResolvedValue({
      customRoomKey: "custom-cached",
      setupRoomId: "setup-cached",
      created: true,
    });
    networkMocks.resolveCustomRoom.mockResolvedValue({
      customRoomKey: "custom-cached",
      setupRoomId: "setup-cached",
      created: false,
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Create/Join custom room" }),
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
    const modeSelect = screen.getByLabelText("Game Mode");
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

    const maxPlayersInput = screen.getByLabelText("Max Players");
    fireEvent.focus(maxPlayersInput);
    fireEvent.change(maxPlayersInput, {
      target: { value: "6" },
    });
    fireEvent.blur(maxPlayersInput);
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
        { playersPerTeam: 2 },
      ),
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/match/setup-one-team", auth());

    expect(await screen.findByText("You are host")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Force start game" }),
    ).toBeNull();
    expect(screen.getByText(/at least two teams/)).toBeTruthy();
  });

  it("shows setup validation failures as stacked toasts without leaving the room", async () => {
    const setupRoom = createRoom({
      roomId: "setup-validation",
      state: createSetupState([
        {
          id: "player-1",
          displayName: "Nova",
          color: PLAYER_COLOR_PALETTE[0],
          isHost: true,
        },
      ]),
    });
    networkMocks.joinById.mockResolvedValue(setupRoom);

    renderRoute("/match/setup-validation", auth());

    expect(await screen.findByText("You are host")).toBeTruthy();

    act(() => {
      setupRoom.emitMessage(SetupServerMessage.VALIDATION_FAILED, {
        severity: "warning",
        field: "mapWidth",
        message: "Map width is below the allowed minimum.",
      });
    });

    await waitFor(() => {
      expect(toastMock.warning).toHaveBeenCalledWith("Settings not applied", {
        description: "Map width is below the allowed minimum.",
        duration: 5_000,
      });
    });

    act(() => {
      setupRoom.emitMessage(SetupServerMessage.VALIDATION_FAILED, {
        severity: "warning",
        field: "mapHeight",
        message: "Map height is below the allowed minimum.",
      });
    });

    await waitFor(() => {
      expect(toastMock.warning).toHaveBeenCalledTimes(2);
    });
    expect(toastMock.warning).toHaveBeenNthCalledWith(
      2,
      "Settings not applied",
      {
        description: "Map height is below the allowed minimum.",
        duration: 5_000,
      },
    );
    expect(
      screen.queryByRole("heading", { name: "Room unavailable" }),
    ).toBeNull();
    expect(screen.getByText("You are host")).toBeTruthy();
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

  it("sends a clear-queue message from the match input surface", async () => {
    const setupRoom = createRoom({
      roomId: "setup-clear-queue",
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
      roomId: "match-clear-queue",
      state: createMatchState(),
    });
    const reservation = {
      name: ROOM_NAMES.MATCH,
      roomId: "match-clear-queue",
      sessionId: "session-1",
    };
    networkMocks.joinById.mockResolvedValue(setupRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/match/setup-clear-queue", auth());

    await screen.findByText("You are host");
    setupRoom.emitMessage(SetupServerMessage.SEAT_RESERVATION, reservation);

    fireEvent.click(await screen.findByTestId("game-app"));

    expect(matchRoom.send).toHaveBeenCalledWith(MatchClientMessage.CLEAR_QUEUE);
  });

  it("resolves a fresh setup room after returning from a finished custom match", async () => {
    const setupRoom = createRoom({
      roomId: "setup-result-a",
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
    const recreatedSetupRoom = createRoom({
      roomId: "setup-result-b",
      state: createSetupState([
        {
          id: "player-1",
          displayName: "Nova",
          color: PLAYER_COLOR_PALETTE[0],
          isHost: true,
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
    networkMocks.resolveCustomRoom
      .mockResolvedValueOnce({
        customRoomKey: "custom-result",
        setupRoomId: "setup-result-a",
        created: false,
      })
      .mockResolvedValueOnce({
        customRoomKey: "custom-result",
        setupRoomId: "setup-result-b",
        created: true,
      });
    networkMocks.joinById
      .mockResolvedValueOnce(setupRoom)
      .mockResolvedValueOnce(recreatedSetupRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/match/custom-result", auth());

    await screen.findByText("You are host");
    setupRoom.emitMessage(SetupServerMessage.SEAT_RESERVATION, reservation);
    await screen.findByTestId("game-app");

    await act(async () => {
      matchRoom.emitMessage(MatchServerMessage.GAME_END, {
        mode: GameMode.CLASSIC,
        winnerTeamId: "team_1",
      });
    });

    expect(
      await screen.findByRole("dialog", { name: "You lost" }),
    ).toBeTruthy();
    expect(screen.getByText("Winner: Rook")).toBeTruthy();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: "Return to setup room" }),
      );
    });

    expect(await screen.findByText("You are host")).toBeTruthy();
    expect(networkMocks.resolveCustomRoom).toHaveBeenNthCalledWith(
      2,
      "custom-result",
    );
    expect(networkMocks.joinById).toHaveBeenNthCalledWith(1, "setup-result-a");
    expect(networkMocks.joinById).toHaveBeenNthCalledWith(2, "setup-result-b");

    await act(async () => {
      recreatedSetupRoom.emitState(
        createSetupState([
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
      );
    });

    await act(async () => {
      await user.click(
        await screen.findByRole("button", { name: "Force start game" }),
      );
    });
    await waitFor(() => {
      expect(recreatedSetupRoom.send).toHaveBeenLastCalledWith(
        SetupClientMessage.START_GAME,
      );
    });
  });

  it("shows a clear error for unavailable custom rooms", async () => {
    networkMocks.resolveCustomRoom.mockRejectedValue(
      new Error("room not found"),
    );

    renderRoute("/match/missing-room", auth());

    expect(
      await screen.findByRole("heading", { name: "Room unavailable" }),
    ).toBeTruthy();
    expect(screen.getByText(/room not found/)).toBeTruthy();
  });

  it("shows a disconnect dialog when the active match room drops", async () => {
    const queueRoom = createRoom({
      roomId: "queue-disconnect",
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
      roomId: "match-disconnect",
      state: createMatchState(),
    });
    const reservation = {
      name: ROOM_NAMES.MATCH,
      roomId: "match-disconnect",
      sessionId: "session-1",
    };

    networkMocks.joinOrCreate.mockResolvedValue(queueRoom);
    networkMocks.consumeSeatReservation.mockResolvedValue(matchRoom);

    renderRoute("/", auth());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Classic, Ready" }));

    await screen.findByText("Pick Your Color");
    queueRoom.emitMessage(QueueServerMessage.SEAT_RESERVATION, reservation);
    await screen.findByTestId("game-app");

    await act(async () => {
      matchRoom.emitLeave(1006, "Your connection to the match was lost.");
    });

    expect(await screen.findByText("Disconnected")).toBeTruthy();
    expect(
      screen.getByText("Your connection to the match was lost."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Return to lobby" }));

    expect(await screen.findByRole("button", { name: "Start" })).toBeTruthy();
  });
});
