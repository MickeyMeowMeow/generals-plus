import { describe, expect, it, vi } from "vitest";

import type {
  ColyseusClientLike,
  ColyseusRoomLike,
} from "#/infra/colyseus/connection";
import {
  ColyseusConnectionGateway,
  DEFAULT_COLYSEUS_ENDPOINT,
  resolveColyseusEndpoint,
} from "#/infra/colyseus/connection";

interface MatchState {
  tick: number;
}

interface MatchMessage {
  text: string;
}

describe("colyseus connection gateway", () => {
  it("uses default endpoint when env is empty", () => {
    expect(resolveColyseusEndpoint({})).toBe(DEFAULT_COLYSEUS_ENDPOINT);
    expect(resolveColyseusEndpoint({ VITE_COLYSEUS_ENDPOINT: "   " })).toBe(
      DEFAULT_COLYSEUS_ENDPOINT,
    );
  });

  it("uses configured endpoint when env exists", () => {
    expect(
      resolveColyseusEndpoint({
        VITE_COLYSEUS_ENDPOINT: "ws://localhost:3579",
      }),
    ).toBe("ws://localhost:3579");
  });

  it("joins a room and binds all handlers", async () => {
    const room: ColyseusRoomLike<MatchState, MatchMessage> = {
      roomId: "room-1",
      sessionId: "session-1",
      leave: vi.fn().mockResolvedValue(1000),
      onStateChange: vi.fn(),
      onMessage: vi.fn(),
      onError: vi.fn(),
      onLeave: vi.fn(),
    };

    const joinOrCreate = vi.fn().mockResolvedValue(room);
    const client: ColyseusClientLike = {
      joinOrCreate,
    };

    const onStateChange = vi.fn();
    const onMessage = vi.fn();
    const onError = vi.fn();
    const onLeave = vi.fn();

    const gateway = new ColyseusConnectionGateway(client);
    const joinedRoom = await gateway.joinRoom(
      {
        roomName: "battle",
      },
      {
        onStateChange,
        onMessage,
        onError,
        onLeave,
      },
    );

    expect(joinOrCreate).toHaveBeenCalledWith("battle", {});
    expect(joinedRoom).toBe(room);

    expect(room.onStateChange).toHaveBeenCalledWith(onStateChange);
    expect(room.onMessage).toHaveBeenCalledWith("*", onMessage);
    expect(room.onError).toHaveBeenCalledWith(onError);
    expect(room.onLeave).toHaveBeenCalledWith(onLeave);
  });

  it("delegates leaveRoom to room.leave", async () => {
    const room: ColyseusRoomLike = {
      roomId: "room-2",
      sessionId: "session-2",
      leave: vi.fn().mockResolvedValue(1000),
      onStateChange: vi.fn(),
      onMessage: vi.fn(),
      onError: vi.fn(),
      onLeave: vi.fn(),
    };

    const client: ColyseusClientLike = {
      joinOrCreate: vi.fn(),
    };

    const gateway = new ColyseusConnectionGateway(client);
    await gateway.leaveRoom(room);

    expect(room.leave).toHaveBeenCalledWith(true);
  });
});
