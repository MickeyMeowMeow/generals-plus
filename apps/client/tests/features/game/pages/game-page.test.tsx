// @vitest-environment jsdom

import {
  GameMode,
  PlayerStatus,
  Terrain,
  Visibility,
} from "@generals-plus/engine";
import { ClassicScoreboard, Player } from "@generals-plus/shared-types";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GamePage } from "#/features/game/pages/game-page";
import type { RenderGridCell } from "#/features/game/renderer/render-grid";
import { SquareRenderGrid } from "#/features/game/renderer/render-grid";
import { MoveDirection } from "#/features/game/utils/move";

const { sendMoveMock, surrenderMock, useGameRoomMock } = vi.hoisted(() => ({
  sendMoveMock: vi.fn(),
  surrenderMock: vi.fn(),
  useGameRoomMock: vi.fn(),
}));

vi.mock("#/features/game/api/use-game-room", () => ({
  useGameRoom: (...args: unknown[]) => useGameRoomMock(...args),
}));

vi.mock("#/features/game/renderer/game-app", () => ({
  GameApp: ({
    onSelectCell,
    onQueueMove,
  }: {
    onSelectCell: (coord: { x: number; y: number }) => void;
    onQueueMove: (direction: MoveDirection) => void;
  }) => (
    <div>
      <button
        data-testid="select-origin"
        type="button"
        onClick={() => onSelectCell({ x: 0, y: 0 })}
      >
        Select
      </button>
      <button
        data-testid="move-left"
        type="button"
        onClick={() => onQueueMove(MoveDirection.LEFT)}
      >
        Move left
      </button>
      <button
        data-testid="move-right"
        type="button"
        onClick={() => onQueueMove(MoveDirection.RIGHT)}
      >
        Move right
      </button>
    </div>
  ),
}));

vi.mock("#/features/game/components/game-hud", () => ({
  GameHud: () => <div data-testid="match-hud" />,
}));

vi.mock("#/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open = true,
  }: {
    children: ReactNode;
    open?: boolean;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function createRenderGrid(width: number, height: number) {
  const gridData: RenderGridCell[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      coordinate: { x, y },
      terrain: Terrain.PLAIN,
      troopCount: null,
      visibility: Visibility.VISIBLE,
      ownerIndex: null,
      siteIndex: null,
      zoneIndex: null,
      item: null,
    })),
  );
  return new SquareRenderGrid(width, height, gridData);
}

function createRenderGridWithTerrain(
  width: number,
  height: number,
  overrides: Array<{ x: number; y: number; terrain: Terrain }>,
) {
  const renderGrid = createRenderGrid(width, height);
  for (const override of overrides) {
    const cell = renderGrid.get({ x: override.x, y: override.y });
    if (!cell) {
      throw new Error("Expected render grid cell to exist");
    }
    cell.terrain = override.terrain;
  }
  return renderGrid;
}

function createPlayer(overrides: Partial<Player> = {}) {
  const player = new Player();
  player.id = "player-1";
  player.sessionId = "player-1";
  player.teamId = "team-1";
  player.displayName = "Nova";
  player.color = 0x3366ff;
  player.status = PlayerStatus.ACTIVE;
  Object.assign(player, overrides);
  return player;
}

function createScoreboard() {
  const scoreboard = new ClassicScoreboard();
  scoreboard.mode = GameMode.CLASSIC;
  return scoreboard;
}

function createGameState(
  playerOverrides: Partial<Player> = {},
  extraPublicPlayers: Array<{
    id: string;
    teamId: string;
    displayName: string;
    color: number;
    status: PlayerStatus;
  }> = [],
) {
  const player = createPlayer(playerOverrides);
  return {
    mode: GameMode.CLASSIC,
    tick: 42,
    scoreboard: createScoreboard(),
    players: new Map([["player-1", player]]),
    publicPlayers: new Map<
      string,
      {
        id: string;
        teamId: string;
        displayName: string;
        color: number;
        status: PlayerStatus;
      }
    >([
      [
        "player-1",
        {
          id: "player-1",
          teamId: player.teamId,
          displayName: player.displayName,
          color: player.color,
          status: player.status,
        },
      ],
      ...extraPublicPlayers.map(
        (publicPlayer) => [publicPlayer.id, publicPlayer] as const,
      ),
    ]),
  };
}

function createConnection() {
  return {
    type: "reservation" as const,
    reservation: {
      name: "match-room",
      roomId: "room-1",
      sessionId: "session-1",
    },
  };
}

describe("GamePage", () => {
  beforeEach(() => {
    useGameRoomMock.mockReset();
    sendMoveMock.mockReset();
    surrenderMock.mockReset();
  });

  it("does not queue a move that would leave the map", () => {
    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map(),
      currentPlayer: createPlayer(),
      renderGrid: createRenderGrid(1, 1),
      moveQueue: [],
      gameState: createGameState(),
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    fireEvent.click(screen.getByTestId("select-origin"));
    fireEvent.click(screen.getByTestId("move-left"));

    expect(sendMoveMock).not.toHaveBeenCalled();
  });

  it("shows the current turn in the top-left overlay", () => {
    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map(),
      currentPlayer: createPlayer(),
      renderGrid: createRenderGrid(1, 1),
      moveQueue: [],
      gameState: createGameState(),
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    expect(screen.getByText("Turn")).toBeTruthy();
    expect(screen.getByLabelText("42")).toBeTruthy();
    expect(
      screen.getByLabelText("42").closest("[data-animated-number='true']"),
    ).toBeTruthy();
  });

  it("does not queue a move into a known obstacle", () => {
    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map(),
      currentPlayer: createPlayer(),
      renderGrid: createRenderGridWithTerrain(2, 1, [
        { x: 1, y: 0, terrain: Terrain.MOUNTAIN },
      ]),
      moveQueue: [],
      gameState: createGameState(),
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    fireEvent.click(screen.getByTestId("select-origin"));
    fireEvent.click(screen.getByTestId("move-right"));

    expect(sendMoveMock).not.toHaveBeenCalled();
  });

  it("allows viewing a finished game as spectator before returning", () => {
    const onReturn = vi.fn();

    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map([["player-2", "Rook"]]),
      currentPlayer: createPlayer(),
      renderGrid: createRenderGrid(2, 2),
      moveQueue: [],
      gameState: createGameState({}, [
        {
          id: "player-2",
          teamId: "team-2",
          displayName: "Rook",
          color: 0xff6633,
          status: PlayerStatus.ACTIVE,
        },
      ]),
      gameResult: {
        mode: GameMode.CLASSIC,
        winnerTeamId: "team-2",
      },
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn }}
      />,
    );

    expect(screen.getByText("You lost")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View as spectator" }));

    expect(screen.queryByText("You lost")).toBeNull();
    expect(screen.getByRole("button", { name: "Return" })).toBeTruthy();
    expect(onReturn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Return" }));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("shows winning team details for a lost team match", () => {
    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map([
        ["player-2", "Rook"],
        ["player-3", "Slate"],
      ]),
      currentPlayer: createPlayer({ teamId: "team_0" }),
      renderGrid: createRenderGrid(2, 2),
      moveQueue: [],
      gameState: createGameState({ teamId: "team_0" }, [
        {
          id: "player-2",
          teamId: "team_1",
          displayName: "Rook",
          color: 0xff6633,
          status: PlayerStatus.ACTIVE,
        },
        {
          id: "player-3",
          teamId: "team_1",
          displayName: "Slate",
          color: 0x33cc99,
          status: PlayerStatus.ACTIVE,
        },
      ]),
      gameResult: {
        mode: GameMode.CLASSIC,
        winnerTeamId: "team_1",
      },
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    expect(screen.getByText("Your team lost")).toBeTruthy();
    expect(screen.getByText("Winners: Team 2, Rook & Slate")).toBeTruthy();
    expect(screen.queryByText("Winner: Rook")).toBeNull();
  });

  it("uses team victory wording when the current player's team wins", () => {
    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map([
        ["player-1", "Nova"],
        ["player-4", "Mica"],
      ]),
      currentPlayer: createPlayer({ teamId: "team_0" }),
      renderGrid: createRenderGrid(2, 2),
      moveQueue: [],
      gameState: createGameState({ teamId: "team_0" }, [
        {
          id: "player-4",
          teamId: "team_0",
          displayName: "Mica",
          color: 0x44aaee,
          status: PlayerStatus.ACTIVE,
        },
      ]),
      gameResult: {
        mode: GameMode.CLASSIC,
        winnerTeamId: "team_0",
      },
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    expect(screen.getByText("Your team won")).toBeTruthy();
    expect(screen.queryByText("You won")).toBeNull();
  });

  it("offers spectator view after the current player is eliminated", () => {
    const onReturn = vi.fn();

    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map(),
      currentPlayer: createPlayer({ status: PlayerStatus.ELIMINATED }),
      renderGrid: createRenderGrid(2, 2),
      moveQueue: [],
      gameState: createGameState(),
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn }}
      />,
    );

    expect(screen.getByText("You have been eliminated")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View as spectator" }));

    expect(screen.queryByText("You have been eliminated")).toBeNull();
    expect(screen.getByRole("button", { name: "Return" })).toBeTruthy();
    expect(onReturn).not.toHaveBeenCalled();
  });

  it("shows a custom-room return action when match connection fails", () => {
    const onReturn = vi.fn();

    useGameRoomMock.mockReturnValue({
      room: null,
      renderGrid: null,
      moveQueue: [],
      gameState: null,
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      playerColors: new Map(),
      playerNames: new Map(),
      error: "Failed to connect to match",
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "custom", onReturn }}
      />,
    );

    const button = screen.getByRole("button", { name: "Return to setup room" });
    fireEvent.click(button);

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("shows a disconnect dialog after the player loses connection", () => {
    const onReturn = vi.fn();

    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      renderGrid: createRenderGrid(2, 2),
      moveQueue: [],
      gameState: createGameState(),
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      playerColors: new Map(),
      playerNames: new Map(),
      error: null,
      disconnectMessage: "Your connection to the match was lost.",
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn }}
      />,
    );

    expect(screen.getByText("Disconnected")).toBeTruthy();
    expect(
      screen.getByText("Your connection to the match was lost."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Return to lobby" }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("does not open surrender confirmation during match loading", () => {
    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      renderGrid: null,
      moveQueue: [],
      gameState: null,
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      playerColors: new Map(),
      playerNames: new Map(),
      currentPlayer: createPlayer(),
      error: null,
      disconnectMessage: null,
      isConnecting: true,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    const event = new KeyboardEvent("keydown", {
      code: "Escape",
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByText("Surrender match?")).toBeNull();
  });

  it("opens a surrender confirmation dialog on Escape and surrenders on confirm", () => {
    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map(),
      currentPlayer: createPlayer(),
      renderGrid: createRenderGrid(2, 2),
      moveQueue: [],
      gameState: createGameState(),
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    fireEvent.keyDown(window, { code: "Escape" });

    expect(screen.getByText("Surrender match?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Surrender" }));

    expect(surrenderMock).toHaveBeenCalledTimes(1);
  });

  it("clears the active ping tool on C without opening surrender confirmation", () => {
    const roomSendMock = vi.fn();

    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        send: roomSendMock,
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      playerColors: new Map(),
      playerNames: new Map(),
      currentPlayer: createPlayer(),
      renderGrid: createRenderGrid(2, 2),
      moveQueue: [],
      gameState: createGameState(),
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      surrender: surrenderMock,
      error: null,
      disconnectMessage: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={createConnection()}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    fireEvent.click(screen.getByTitle("Mark Attack (Swords) [1]"));
    fireEvent.keyDown(window, { code: "KeyC" });
    fireEvent.click(screen.getByTestId("select-origin"));

    expect(screen.queryByText("Surrender match?")).toBeNull();
    expect(roomSendMock).not.toHaveBeenCalled();
  });
});
