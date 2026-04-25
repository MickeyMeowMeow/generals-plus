import { describe, expect, it, vi } from "vitest";

import type { MatchConnectionGateway } from "#/features/match/store/matchConnectionStore";
import { createMatchConnectionStore } from "#/features/match/store/matchConnectionStore";
import type {
  ColyseusRoom,
  RoomLifecycleHandlers,
} from "#/infra/colyseus/connection";

interface MatchState {
  turn: number;
}

function createRoom(name = "skirmish-room"): ColyseusRoom<MatchState, unknown> {
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
    state: { turn: 0 },
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

describe("match connection store", () => {
  it("starts with idle state", () => {
    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi.fn(),
      reconnect: vi.fn(),
      leaveRoom: vi.fn(),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    expect(store.getState().status).toBe("idle");
    expect(store.getState().roomId).toBeNull();
    expect(store.getState().lastError).toBeNull();
    expect(store.getState().reconnectionToken).toBeNull();
    expect(store.getState().isReconnecting).toBe(false);
  });

  it("connects and sets disconnected status", () => {
    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi.fn(),
      reconnect: vi.fn(),
      leaveRoom: vi.fn(),
    };

    const createGateway = vi.fn().mockReturnValue(gateway);
    const store = createMatchConnectionStore({ createGateway });

    store.getState().connect("ws://localhost:4000");

    expect(createGateway).toHaveBeenLastCalledWith("ws://localhost:4000");
    expect(store.getState().status).toBe("disconnected");
  });

  it("joins room and tracks room metadata", async () => {
    const room = createRoom("alpha-room");

    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn().mockResolvedValue(room),
      joinById: vi.fn(),
      reconnect: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(1000),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().joinRoom("alpha-room", {
      level: "tutorial",
    });

    expect(gateway.joinRoom).toHaveBeenCalledWith(
      {
        roomName: "alpha-room",
        options: { level: "tutorial" },
      },
      expect.any(Object),
    );
    expect(store.getState().status).toBe("connected");
    expect(store.getState().roomId).toBe("room-1");
    expect(store.getState().roomName).toBe("alpha-room");
    expect(store.getState().sessionId).toBe("session-1");
    expect(store.getState().reconnectionToken).toBe("room-1:token-abc");
  });

  it("exposes room via getRoom after joining", async () => {
    const room = createRoom();

    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn().mockResolvedValue(room),
      joinById: vi.fn(),
      reconnect: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(1000),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    expect(store.getState().getRoom()).toBeNull();

    await store.getState().joinRoom("alpha-room");

    expect(store.getState().getRoom()).toBe(room);
  });

  it("joins room by ID and tracks room metadata", async () => {
    const room = createRoom();

    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi.fn().mockResolvedValue(room),
      reconnect: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(1000),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().joinById("room-1", {
      user: { displayName: "test" },
    });

    expect(gateway.joinById).toHaveBeenCalledWith(
      {
        roomId: "room-1",
        options: { user: { displayName: "test" } },
      },
      expect.any(Object),
    );
    expect(store.getState().status).toBe("connected");
    expect(store.getState().roomId).toBe("room-1");
    expect(store.getState().roomName).toBe("skirmish-room");
    expect(store.getState().sessionId).toBe("session-1");
  });

  it("stores error when joinRoom fails", async () => {
    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn().mockRejectedValue(new Error("join failed")),
      joinById: vi.fn(),
      reconnect: vi.fn(),
      leaveRoom: vi.fn(),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().joinRoom("broken-room");

    expect(store.getState().status).toBe("error");
    expect(store.getState().lastError).toBe("join failed");
  });

  it("stores error when joinById fails", async () => {
    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi.fn().mockRejectedValue(new Error("rejoin failed")),
      reconnect: vi.fn(),
      leaveRoom: vi.fn(),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().joinById("nonexistent-room");

    expect(store.getState().status).toBe("error");
    expect(store.getState().lastError).toBe("rejoin failed");
  });

  it("leaves room and resets room metadata", async () => {
    const room = createRoom();

    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn().mockResolvedValue(room),
      joinById: vi.fn(),
      reconnect: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(1000),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().joinRoom("leave-room");
    await store.getState().leaveRoom();

    expect(gateway.leaveRoom).toHaveBeenCalledWith(room, true);
    expect(store.getState().status).toBe("disconnected");
    expect(store.getState().roomId).toBeNull();
    expect(store.getState().sessionId).toBeNull();
    expect(store.getState().reconnectionToken).toBeNull();
    expect(store.getState().getRoom()).toBeNull();
  });

  it("transitions to reconnecting on drop", async () => {
    let handlers: RoomLifecycleHandlers | undefined;
    const room = createRoom();

    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn().mockImplementation(async (_opts, h) => {
        handlers = h;
        return room;
      }),
      joinById: vi.fn(),
      reconnect: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(1000),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().joinRoom("alpha-room");
    expect(store.getState().status).toBe("connected");

    handlers?.onDrop?.(1006, "connection lost");
    expect(store.getState().status).toBe("reconnecting");
    expect(store.getState().isReconnecting).toBe(true);
  });

  it("restores connected state on reconnect event", async () => {
    let handlers: RoomLifecycleHandlers | undefined;
    const room = createRoom();

    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn().mockImplementation(async (_opts, h) => {
        handlers = h;
        return room;
      }),
      joinById: vi.fn(),
      reconnect: vi.fn(),
      leaveRoom: vi.fn().mockResolvedValue(1000),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().joinRoom("alpha-room");
    handlers?.onDrop?.(1006, "connection lost");
    expect(store.getState().status).toBe("reconnecting");

    handlers?.onReconnect?.();
    expect(store.getState().status).toBe("connected");
    expect(store.getState().isReconnecting).toBe(false);
  });

  it("reconnects using a reconnection token", async () => {
    const room = createRoom();
    room.reconnectionToken = "room-1:new-token";

    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi.fn(),
      reconnect: vi.fn().mockResolvedValue(room),
      leaveRoom: vi.fn().mockResolvedValue(1000),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().reconnect("room-1:old-token");

    expect(gateway.reconnect).toHaveBeenCalledWith(
      "room-1:old-token",
      expect.any(Object),
    );
    expect(store.getState().status).toBe("connected");
    expect(store.getState().reconnectionToken).toBe("room-1:new-token");
  });

  it("sets error state when reconnection fails", async () => {
    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi.fn(),
      reconnect: vi.fn().mockRejectedValue(new Error("reconnect failed")),
      leaveRoom: vi.fn(),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    await store.getState().reconnect("stale-token");

    expect(store.getState().status).toBe("error");
    expect(store.getState().lastError).toBe("reconnect failed");
    expect(store.getState().reconnectionToken).toBeNull();
  });
});
