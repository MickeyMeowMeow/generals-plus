// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type { ColyseusClient } from "#/infra/colyseus/connection";
import {
  ColyseusConnectionGateway,
  DEFAULT_COLYSEUS_ENDPOINT,
  resolveColyseusEndpoint,
} from "#/infra/colyseus/connection";
import {
  createAuthStub,
  createMockClient,
  createRoom,
} from "#/tests/helpers/colyseus";

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

  it("joins a room and wires lifecycle handlers", async () => {
    const room = createRoom<MatchState, MatchMessage>();
    const client = createMockClient({
      joinOrCreate: vi.fn().mockResolvedValue(room),
    });

    const onError = vi.fn();
    const onLeave = vi.fn();
    const onDrop = vi.fn();
    const onReconnect = vi.fn();

    const gateway = new ColyseusConnectionGateway(client);
    const joinedRoom = await gateway.joinRoom(
      { roomName: "battle" },
      { onError, onLeave, onDrop, onReconnect },
    );

    expect(client.joinOrCreate).toHaveBeenCalledWith("battle", {});
    expect(joinedRoom).toBe(room);

    expect(room.onError).toHaveBeenCalledWith(onError);
    expect(room.onLeave).toHaveBeenCalledWith(onLeave);
    expect(room.onDrop).toHaveBeenCalledWith(onDrop);
    expect(room.onReconnect).toHaveBeenCalledWith(onReconnect);
  });

  it("wires onDrop and onReconnect handlers", async () => {
    const room = createRoom();
    const client = createMockClient({
      joinOrCreate: vi.fn().mockResolvedValue(room),
    });

    const onDrop = vi.fn();
    const onReconnect = vi.fn();

    const gateway = new ColyseusConnectionGateway(client);
    await gateway.joinRoom({ roomName: "battle" }, { onDrop, onReconnect });

    expect(room.onDrop).toHaveBeenCalledWith(onDrop);
    expect(room.onReconnect).toHaveBeenCalledWith(onReconnect);
  });

  it("reconnects to a room using a reconnection token", async () => {
    const room = createRoom();
    const client = createMockClient({
      reconnect: vi.fn().mockResolvedValue(room),
    });

    const onError = vi.fn();
    const gateway = new ColyseusConnectionGateway(client);
    const reconnectedRoom = await gateway.reconnect("room-1:token-abc", {
      onError,
    });

    expect(client.reconnect).toHaveBeenCalledWith("room-1:token-abc");
    expect(reconnectedRoom).toBe(room);
    expect(room.onError).toHaveBeenCalledWith(onError);
  });

  it("delegates leaveRoom and clears subscriptions", async () => {
    const room = createRoom();
    const onLeaveSub = { clear: vi.fn() };
    room.onLeave = vi.fn().mockReturnValue(onLeaveSub);

    const client = createMockClient({
      joinOrCreate: vi.fn().mockResolvedValue(room),
    });

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
    auth.signInWithEmailAndPassword = vi
      .fn()
      .mockResolvedValue({ user: { id: "user-1" }, token: "token-1" });
    auth.registerWithEmailAndPassword = vi
      .fn()
      .mockResolvedValue({ user: { id: "user-1" }, token: "token-1" });
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
    await expect(
      gateway.signInWithEmailAndPassword("nova@example.com", "hunter22"),
    ).resolves.toEqual({
      user: { id: "user-1" },
      token: "token-1",
    });
    await expect(
      gateway.registerWithEmailAndPassword("nova@example.com", "hunter22", {
        displayName: "Nova",
      }),
    ).resolves.toEqual({
      user: { id: "user-1" },
      token: "token-1",
    });
    await expect(gateway.signInAnonymously({ name: "fox" })).resolves.toEqual({
      user: { id: "user-1" },
      token: "token-1",
    });
    await expect(gateway.signOut()).resolves.toBeUndefined();

    expect(auth.getUserData).toHaveBeenCalledTimes(1);
    expect(auth.signInWithEmailAndPassword).toHaveBeenCalledWith(
      "nova@example.com",
      "hunter22",
    );
    expect(auth.registerWithEmailAndPassword).toHaveBeenCalledWith(
      "nova@example.com",
      "hunter22",
      { displayName: "Nova" },
    );
    expect(auth.signInAnonymously).toHaveBeenCalledWith({ name: "fox" });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
