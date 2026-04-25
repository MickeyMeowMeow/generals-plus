import { describe, expect, it, vi } from "vitest";

import type { MatchConnectionGateway } from "#/features/match/store/matchConnectionStore";
import { createMatchConnectionStore } from "#/features/match/store/matchConnectionStore";
import type {
  ColyseusRoom,
  JoinByIdOptions,
  JoinRoomOptions,
  RoomEventHandlers,
} from "#/infra/colyseus/connection";

interface MatchState {
  turn: number;
}

interface MatchMessage {
  kind: string;
}

function createRoom(
  name = "skirmish-room",
): ColyseusRoom<MatchState, MatchMessage> {
  return {
    roomId: "room-1",
    name,
    sessionId: "session-1",
    leave: vi.fn().mockResolvedValue(1000),
    onStateChange: vi.fn(),
    onMessage: vi.fn(),
    onError: vi.fn(),
    onLeave: vi.fn(),
  };
}

describe("match connection store", () => {
  it("starts with idle state", () => {
    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi.fn(),
      leaveRoom: vi.fn(),
    };

    const store = createMatchConnectionStore({
      createGateway: () => gateway,
    });

    expect(store.getState().status).toBe("idle");
    expect(store.getState().roomId).toBeNull();
    expect(store.getState().lastError).toBeNull();
  });

  it("connects and sets disconnected status", () => {
    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi.fn(),
      leaveRoom: vi.fn(),
    };

    const createGateway = vi.fn().mockReturnValue(gateway);
    const store = createMatchConnectionStore({
      createGateway,
    });

    store.getState().connect("ws://localhost:4000");

    expect(createGateway).toHaveBeenLastCalledWith("ws://localhost:4000");
    expect(store.getState().status).toBe("disconnected");
  });

  it("joins room and tracks room metadata", async () => {
    const room = createRoom("alpha-room");
    let handlers: RoomEventHandlers<MatchState, MatchMessage> | undefined;

    const gateway: MatchConnectionGateway = {
      joinRoom: vi
        .fn()
        .mockImplementation(
          async (
            _joinOptions: JoinRoomOptions,
            nextHandlers?: RoomEventHandlers<MatchState, MatchMessage>,
          ) => {
            handlers = nextHandlers;
            return room;
          },
        ),
      joinById: vi.fn(),
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

    handlers?.onStateChange?.({ turn: 2 });

    expect(store.getState().latestState).toEqual({ turn: 2 });
  });

  it("joins room by ID and tracks room metadata", async () => {
    const room = createRoom();
    let handlers: RoomEventHandlers<MatchState, MatchMessage> | undefined;

    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn(),
      joinById: vi
        .fn()
        .mockImplementation(
          async (
            _joinOptions: JoinByIdOptions,
            nextHandlers?: RoomEventHandlers<MatchState, MatchMessage>,
          ) => {
            handlers = nextHandlers;
            return room;
          },
        ),
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

    handlers?.onStateChange?.({ turn: 5 });

    expect(store.getState().latestState).toEqual({ turn: 5 });
  });

  it("stores error when joinRoom fails", async () => {
    const gateway: MatchConnectionGateway = {
      joinRoom: vi.fn().mockRejectedValue(new Error("join failed")),
      joinById: vi.fn(),
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
  });
});
