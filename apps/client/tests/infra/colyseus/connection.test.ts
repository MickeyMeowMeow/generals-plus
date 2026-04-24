// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type {
  ColyseusAuthLike,
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

function createAuthStub(): ColyseusAuthLike {
  return {
    token: null,
    onChange: vi.fn().mockReturnValue(() => {}),
    getUserData: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
  };
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
      auth: createAuthStub(),
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
      auth: createAuthStub(),
      joinOrCreate: vi.fn(),
    };

    const gateway = new ColyseusConnectionGateway(client);
    await gateway.leaveRoom(room);

    expect(room.leave).toHaveBeenCalledWith(true);
  });

  it("delegates auth operations to the underlying client", async () => {
    const auth = createAuthStub();
    const onAuthChange = vi.fn();

    auth.token = "token-1";
    auth.onChange = vi.fn().mockReturnValue(() => {});
    auth.getUserData = vi.fn().mockResolvedValue({ id: "user-1" });
    auth.signInAnonymously = vi
      .fn()
      .mockResolvedValue({ user: { id: "user-1" }, token: "token-1" });
    auth.signOut = vi.fn().mockResolvedValue(undefined);

    const client: ColyseusClientLike = {
      auth,
      joinOrCreate: vi.fn(),
    };

    const gateway = new ColyseusConnectionGateway(client);

    expect(gateway.getAuthToken()).toBe("token-1");
    expect(gateway.onAuthChange(onAuthChange)).toBeTypeOf("function");
    expect(auth.onChange).toHaveBeenCalledWith(onAuthChange);

    await expect(gateway.getUserData()).resolves.toEqual({ id: "user-1" });
    await expect(gateway.signInAnonymously({ name: "fox" })).resolves.toEqual({
      user: { id: "user-1" },
      token: "token-1",
    });
    await expect(gateway.signOut()).resolves.toBeUndefined();

    expect(auth.getUserData).toHaveBeenCalledTimes(1);
    expect(auth.signInAnonymously).toHaveBeenCalledWith({ name: "fox" });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
