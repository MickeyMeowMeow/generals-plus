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
import { RenderGrid } from "#/features/game/renderer/render-grid";
import { MoveDirection } from "#/features/game/utils/move";

const {
  clearPersistedGameSessionMock,
  navigateMock,
  sendMoveMock,
  useGameRoomMock,
} = vi.hoisted(() => ({
  clearPersistedGameSessionMock: vi.fn(),
  navigateMock: vi.fn(),
  sendMoveMock: vi.fn(),
  useGameRoomMock: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("#/features/game/api/use-game-room", () => ({
  clearPersistedGameSession: clearPersistedGameSessionMock,
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
    </div>
  ),
}));

vi.mock("#/features/game/components/game-hud", () => ({
  GameHud: () => <div data-testid="match-hud" />,
}));

vi.mock("#/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => (
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
    })),
  );
  return new RenderGrid(width, height, gridData);
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

describe("GamePage keyboard move bounds", () => {
  beforeEach(() => {
    clearPersistedGameSessionMock.mockReset();
    useGameRoomMock.mockReset();
    sendMoveMock.mockReset();
    navigateMock.mockReset();
  });

  it("does not queue a move that would leave the map", () => {
    const player = createPlayer();

    useGameRoomMock.mockReturnValue({
      room: {
        sessionId: "player-1",
        onMessage: vi.fn().mockReturnValue(() => {}),
      },
      renderGrid: createRenderGrid(1, 1),
      moveQueue: [],
      gameState: {
        mode: GameMode.CLASSIC,
        scoreboard: createScoreboard(),
        players: new Map([["player-1", player]]),
        publicPlayers: new Map(),
      },
      gameResult: null,
      sendMove: sendMoveMock,
      clearMoveQueue: vi.fn(),
      playerColors: new Map(),
      playerNames: new Map(),
      connectionStatus: "connected",
      error: null,
      isConnecting: false,
    });

    render(
      <GamePage
        connection={{
          type: "recovery",
          recoveryToken: "token-1",
        }}
        source={{ type: "official", onReturn: vi.fn() }}
      />,
    );

    fireEvent.click(screen.getByTestId("select-origin"));
    fireEvent.click(screen.getByTestId("move-left"));

    expect(sendMoveMock).not.toHaveBeenCalled();
  });
});
