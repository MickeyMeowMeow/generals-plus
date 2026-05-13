import type { ICoordinate, IGameResult } from "@generals-plus/engine";
import { GameStatus, PlayerStatus } from "@generals-plus/engine";
import {
  MatchServerMessage,
  MatchState,
  Player,
} from "@generals-plus/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGameRoom } from "#/features/game/api/use-game-room";
import { networkProvider } from "#/infra/network/provider";
import type { RoomClient } from "#/infra/network/room";

vi.mock("#/infra/network/provider", () => ({
  networkProvider: {
    consumeSeatReservation: vi.fn(),
  },
}));

const CurrentUserId = "p1";
const SessionId = "session-1";
const RoomId = "room-1";
const Reservation = {} as Parameters<typeof useGameRoom>[0];
const FromCoordinate: ICoordinate = { x: 1, y: 1 };
const ToCoordinate: ICoordinate = { x: 2, y: 1 };

class GameRoomTestHarness {
  readonly send = vi.fn();
  readonly leave = vi.fn().mockResolvedValue(undefined);
  private stateChangeHandler: ((state: MatchState) => void) | null = null;
  private gameEndHandler: ((result: IGameResult) => void) | null = null;

  readonly room: RoomClient = {
    roomId: RoomId,
    sessionId: SessionId,
    state: new MatchState(),
    send: this.send,
    leave: this.leave,
    onStateChange: vi.fn((handler: (state: MatchState) => void) => {
      this.stateChangeHandler = handler;
      return vi.fn();
    }),
    onMessage: vi.fn((type, handler) => {
      if (type === MatchServerMessage.GAME_END) {
        this.gameEndHandler = handler as (result: IGameResult) => void;
      }
      return vi.fn();
    }),
    onStatusChange: vi.fn().mockReturnValue(vi.fn()),
    getRecoveryToken: vi.fn().mockReturnValue(null),
  };

  pushState(status: GameStatus, playerStatus: PlayerStatus): void {
    const state = new MatchState();
    const player = new Player();
    player.id = CurrentUserId;
    player.status = playerStatus;
    state.status = status;
    state.players.set(CurrentUserId, player);
    this.stateChangeHandler?.(state);
  }

  pushGameEnd(result: IGameResult): void {
    this.gameEndHandler?.(result);
  }
}

describe("useGameRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not send move after local player is eliminated", async () => {
    const harness = new GameRoomTestHarness();
    vi.mocked(networkProvider.consumeSeatReservation).mockResolvedValue(
      harness.room,
    );

    const { result } = renderHook(() =>
      useGameRoom(Reservation, CurrentUserId),
    );

    await waitFor(() => expect(harness.room.onStateChange).toHaveBeenCalled());

    act(() => {
      harness.pushState(GameStatus.PLAYING, PlayerStatus.ELIMINATED);
    });
    act(() => {
      result.current.sendMove(FromCoordinate, ToCoordinate);
    });

    expect(harness.send).not.toHaveBeenCalled();
  });

  it("does not send move after game is finished", async () => {
    const harness = new GameRoomTestHarness();
    vi.mocked(networkProvider.consumeSeatReservation).mockResolvedValue(
      harness.room,
    );

    const { result } = renderHook(() =>
      useGameRoom(Reservation, CurrentUserId),
    );

    await waitFor(() => expect(harness.room.onStateChange).toHaveBeenCalled());

    act(() => {
      harness.pushState(GameStatus.FINISHED, PlayerStatus.ACTIVE);
    });
    act(() => {
      result.current.sendMove(FromCoordinate, ToCoordinate);
    });

    expect(harness.send).not.toHaveBeenCalled();
  });

  it("does not leave the room twice after explicit exit", async () => {
    const harness = new GameRoomTestHarness();
    vi.mocked(networkProvider.consumeSeatReservation).mockResolvedValue(
      harness.room,
    );

    const { result, unmount } = renderHook(() =>
      useGameRoom(Reservation, CurrentUserId),
    );

    await waitFor(() => expect(result.current.room).toBe(harness.room));

    await act(async () => {
      await result.current.leaveRoom();
    });
    unmount();

    expect(harness.leave).toHaveBeenCalledOnce();
  });

  it("marks room as finished when game end message arrives", async () => {
    const harness = new GameRoomTestHarness();
    vi.mocked(networkProvider.consumeSeatReservation).mockResolvedValue(
      harness.room,
    );

    const { result } = renderHook(() =>
      useGameRoom(Reservation, CurrentUserId),
    );

    await waitFor(() => expect(harness.room.onMessage).toHaveBeenCalled());

    act(() => {
      harness.pushGameEnd({
        mode: "classic",
        winnerTeamId: "team_0",
      });
    });

    expect(result.current.isFinished).toBe(true);
    expect(result.current.gameResult?.winnerTeamId).toBe("team_0");
  });
});
