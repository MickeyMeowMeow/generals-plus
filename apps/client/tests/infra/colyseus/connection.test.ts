// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type {
  ColyseusAuth,
  ColyseusClient,
  ColyseusRoom,
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

function createAuthStub(): ColyseusAuth {
  return {
    token: null,
    onChange: vi.fn().mockReturnValue(() => {}),
    getUserData: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
  };
}

function createRoom(
  name = "skirmish-room",
): ColyseusRoom<MatchState, MatchMessage> {
  return {
    roomId: "room-1",
    name,
    sessionId: "session-1",
    reconnectionToken: "room-1:token-abc",
    reconnection: {
      enabled: true,
      maxRetries: 15,
      minDelay: 100,
      maxDelay: 5000,
      minUptime: 5000,
      delay: 100,
      backoff: vi.fn(),
      maxEnqueuedMessages: 10,
      enqueuedMessages: [],
      retryCount: 0,
      isReconnecting: false,
    },
    state: { tick: 0 },
    leave: vi.fn().mockResolvedValue(1000),
    send: vi.fn(),
    sendBytes: vi.fn(),
    sendUnreliable: vi.fn(),
    ping: vi.fn(),
    removeAllListeners: vi.fn(),
    onStateChange: vi.fn().mockReturnValue({ clear: vi.fn() }),
    onMessage: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue({ clear: vi.fn() }),
    onLeave: vi.fn().mockReturnValue({ clear: vi.fn() }),
    onDrop: vi.fn().mockReturnValue({ clear: vi.fn() }),
    onReconnect: vi.fn().mockReturnValue({ clear: vi.fn() }),
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

  it("joins a room and wires lifecycle handlers", async () => {
    const room = createRoom();
    const joinOrCreate = vi.fn().mockResolvedValue(room);
    const client: ColyseusClient = {
      auth: createAuthStub(),
      joinOrCreate,
      joinById: vi.fn(),
      create: vi.fn(),
      join: vi.fn(),
      reconnect: vi.fn(),
      consumeSeatReservation: vi.fn(),
      getLatency: vi.fn(),
      http: {},
    };

    const onError = vi.fn();
    const onLeave = vi.fn();
    const onDrop = vi.fn();
    const onReconnect = vi.fn();

    const gateway = new ColyseusConnectionGateway(client);
    const joinedRoom = await gateway.joinRoom(
      { roomName: "battle" },
      { onError, onLeave, onDrop, onReconnect },
    );

    expect(joinOrCreate).toHaveBeenCalledWith("battle", {});
    expect(joinedRoom).toBe(room);

    expect(room.onError).toHaveBeenCalledWith(onError);
    expect(room.onLeave).toHaveBeenCalledWith(onLeave);
    expect(room.onDrop).toHaveBeenCalledWith(onDrop);
    expect(room.onReconnect).toHaveBeenCalledWith(onReconnect);
  });

  it("wires onDrop and onReconnect handlers", async () => {
    const room = createRoom();
    const client: ColyseusClient = {
      auth: createAuthStub(),
      joinOrCreate: vi.fn().mockResolvedValue(room),
      joinById: vi.fn(),
      create: vi.fn(),
      join: vi.fn(),
      reconnect: vi.fn(),
      consumeSeatReservation: vi.fn(),
      getLatency: vi.fn(),
      http: {},
    };

    const onDrop = vi.fn();
    const onReconnect = vi.fn();

    const gateway = new ColyseusConnectionGateway(client);
    await gateway.joinRoom({ roomName: "battle" }, { onDrop, onReconnect });

    expect(room.onDrop).toHaveBeenCalledWith(onDrop);
    expect(room.onReconnect).toHaveBeenCalledWith(onReconnect);
  });

  it("reconnects to a room using a reconnection token", async () => {
    const room = createRoom();
    const reconnect = vi.fn().mockResolvedValue(room);
    const client: ColyseusClient = {
      auth: createAuthStub(),
      joinOrCreate: vi.fn(),
      joinById: vi.fn(),
      create: vi.fn(),
      join: vi.fn(),
      reconnect,
      consumeSeatReservation: vi.fn(),
      getLatency: vi.fn(),
      http: {},
    };

    const onError = vi.fn();
    const gateway = new ColyseusConnectionGateway(client);
    const reconnectedRoom = await gateway.reconnect("room-1:token-abc", {
      onError,
    });

    expect(reconnect).toHaveBeenCalledWith("room-1:token-abc");
    expect(reconnectedRoom).toBe(room);
    expect(room.onError).toHaveBeenCalledWith(onError);
  });

  it("delegates leaveRoom and clears subscriptions", async () => {
    const room = createRoom();
    const onLeaveSub = { clear: vi.fn() };
    room.onLeave = vi.fn().mockReturnValue(onLeaveSub);

    const client: ColyseusClient = {
      auth: createAuthStub(),
      joinOrCreate: vi.fn().mockResolvedValue(room),
      joinById: vi.fn(),
      create: vi.fn(),
      join: vi.fn(),
      reconnect: vi.fn(),
      consumeSeatReservation: vi.fn(),
      getLatency: vi.fn(),
      http: {},
    };

    const gateway = new ColyseusConnectionGateway(client);
    await gateway.joinRoom({ roomName: "battle" }, { onLeave: vi.fn() });
    await gateway.leaveRoom(room);

    expect(onLeaveSub.clear).toHaveBeenCalled();
    expect(room.leave).toHaveBeenCalledWith(true);
  });

  it("delegates auth operations to the underlying client", async () => {
    const auth = createAuthStub();
    const onAuthChange = vi.fn();

    auth.token = "token-1";
    auth.onChange = vi.fn().mockReturnValue(() => {});
    auth.getUserData = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
    auth.signInAnonymously = vi
      .fn()
      .mockResolvedValue({ user: { id: "user-1" }, token: "token-1" });
    auth.signOut = vi.fn().mockResolvedValue(undefined);

    const client: ColyseusClient = {
      auth,
      joinOrCreate: vi.fn(),
      joinById: vi.fn(),
      create: vi.fn(),
      join: vi.fn(),
      reconnect: vi.fn(),
      consumeSeatReservation: vi.fn(),
      getLatency: vi.fn(),
      http: {},
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
