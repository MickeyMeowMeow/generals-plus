import { create } from "zustand";

import type {
  ColyseusRoom,
  JoinByIdOptions,
  JoinRoomOptions,
  RoomLifecycleHandlers,
} from "#/infra/colyseus/connection";
import { createSharedColyseusConnectionGateway } from "#/infra/colyseus/connection";

// State machine for the match room connection lifecycle:
// idle → connecting → connected → disconnected
// connected → reconnecting → connected (onDrop/onReconnect)
// Any stage can transition to error.
export type MatchConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "disconnected";

// Zustand store shape for match room connection state and actions.
export interface MatchConnectionStore {
  status: MatchConnectionStatus;
  roomId: string | null;
  roomName: string | null;
  sessionId: string | null;
  reconnectionToken: string | null;
  isReconnecting: boolean;
  lastError: string | null;

  // Room access for Callbacks + onMessage in feature code.
  getRoom: () => ColyseusRoom | null;

  connect: (endpoint?: string) => void;
  joinRoom: (
    roomName: string,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  joinById: (
    roomId: string,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  reconnect: (reconnectionToken?: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setError: (message: string) => void;
  reset: () => Promise<void>;
}

// Abstraction over Colyseus room operations, allowing tests to inject fakes.
export interface MatchConnectionGateway {
  joinRoom<State = unknown, Message = unknown>(
    joinOptions: JoinRoomOptions,
    handlers?: RoomLifecycleHandlers,
  ): Promise<ColyseusRoom<State, Message>>;
  joinById<State = unknown, Message = unknown>(
    joinOptions: JoinByIdOptions,
    handlers?: RoomLifecycleHandlers,
  ): Promise<ColyseusRoom<State, Message>>;
  reconnect<State = unknown, Message = unknown>(
    reconnectionToken: string,
    handlers?: RoomLifecycleHandlers,
  ): Promise<ColyseusRoom<State, Message>>;
  leaveRoom(room: ColyseusRoom, consented?: boolean): Promise<number>;
}

// Factory dependencies injected into the store for testability.
export interface MatchConnectionDependencies {
  createGateway: (endpoint?: string) => MatchConnectionGateway;
}

// localStorage keys for persisting reconnection tokens across page refreshes.
const RECONNECTION_TOKEN_KEY = "colyseus_reconnection_token";
const RECONNECTION_ROOM_ID_KEY = "colyseus_reconnection_room_id";

function persistReconnectionToken(token: string, roomId: string): void {
  try {
    localStorage.setItem(RECONNECTION_TOKEN_KEY, token);
    localStorage.setItem(RECONNECTION_ROOM_ID_KEY, roomId);
  } catch {
    // localStorage may be unavailable (SSR, quota, etc.)
  }
}

function loadPersistedReconnectionToken(): {
  token: string;
  roomId: string;
} | null {
  try {
    const token = localStorage.getItem(RECONNECTION_TOKEN_KEY);
    const roomId = localStorage.getItem(RECONNECTION_ROOM_ID_KEY);
    if (token && roomId) return { token, roomId };
  } catch {
    // localStorage may be unavailable
  }
  return null;
}

function clearPersistedReconnectionToken(): void {
  try {
    localStorage.removeItem(RECONNECTION_TOKEN_KEY);
    localStorage.removeItem(RECONNECTION_ROOM_ID_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

// Shared reset shape for disconnected state.
const disconnectedState = {
  status: "disconnected" as const,
  roomId: null as string | null,
  roomName: null as string | null,
  sessionId: null as string | null,
  reconnectionToken: null as string | null,
  isReconnecting: false,
  lastError: null as string | null,
};

// Fields to reset when entering error state (excludes status and lastError).
const errorFields = {
  roomId: null as string | null,
  roomName: null as string | null,
  sessionId: null as string | null,
  reconnectionToken: null as string | null,
  isReconnecting: false,
};

// Coerce an unknown thrown value into a readable string.
function normalizeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

const createInitialState = (): Omit<
  MatchConnectionStore,
  | "getRoom"
  | "connect"
  | "joinRoom"
  | "joinById"
  | "reconnect"
  | "leaveRoom"
  | "setError"
  | "reset"
> => ({
  status: "idle",
  roomId: null,
  roomName: null,
  sessionId: null,
  reconnectionToken: null,
  isReconnecting: false,
  lastError: null,
});

// Factory that creates a Zustand store for managing a single active match room.
// Accepts optional dependencies so tests can inject a fake gateway.
export function createMatchConnectionStore(
  dependencies: MatchConnectionDependencies = {
    createGateway: createSharedColyseusConnectionGateway,
  },
) {
  // Mutable references held outside Zustand state to avoid triggering re-renders.
  let gateway: MatchConnectionGateway | null = null;
  let activeRoom: ColyseusRoom | null = null;
  let joinGeneration = 0;

  // Lazily create or replace the gateway instance.
  const resolveGateway = (endpoint?: string): MatchConnectionGateway => {
    if (endpoint) {
      gateway = dependencies.createGateway(endpoint);
      return gateway;
    }

    if (!gateway) {
      gateway = dependencies.createGateway();
    }

    return gateway;
  };

  return create<MatchConnectionStore>()((set, get) => {
    // Shared lifecycle handlers used by joinRoom, joinById, and reconnect.
    // Uses a generation counter to discard stale callbacks from previous rooms.
    const createLifecycleHandlers = (
      generation: number,
    ): RoomLifecycleHandlers => ({
      onError: (_code: number, message?: string) => {
        if (generation !== joinGeneration) return;
        get().setError(message ?? "Room connection error");
      },
      onLeave: () => {
        if (generation !== joinGeneration) return;
        activeRoom = null;
        clearPersistedReconnectionToken();
        set(disconnectedState);
      },
      onDrop: () => {
        if (generation !== joinGeneration) return;
        set({ status: "reconnecting", isReconnecting: true });
      },
      onReconnect: () => {
        if (generation !== joinGeneration) return;
        // Re-read reconnectionToken from the room after SDK auto-reconnect.
        const token = activeRoom?.reconnectionToken ?? null;
        if (token) {
          persistReconnectionToken(token, activeRoom!.roomId);
        }
        set({
          status: "connected",
          isReconnecting: false,
          reconnectionToken: token,
        });
      },
    });

    // Shared success handler: persist token, update store, reject stale rooms.
    const onRoomConnected = (
      room: ColyseusRoom,
      generation: number,
    ): boolean => {
      if (generation !== joinGeneration) return false;
      activeRoom = room;
      if (room.reconnectionToken) {
        persistReconnectionToken(room.reconnectionToken, room.roomId);
      }
      set({
        status: "connected",
        roomId: room.roomId,
        roomName: room.name,
        sessionId: room.sessionId,
        reconnectionToken: room.reconnectionToken,
        isReconnecting: false,
        lastError: null,
      });
      return true;
    };

    return {
      ...createInitialState(),

      getRoom: () => activeRoom,

      connect(endpoint) {
        // Tear down any active room before switching gateways.
        if (activeRoom) {
          const previousRoom = activeRoom;
          activeRoom = null;
          joinGeneration++;
          void resolveGateway()
            .leaveRoom(previousRoom, true)
            .catch(() => {});
        }

        gateway = resolveGateway(endpoint);
        set({ ...createInitialState(), status: "disconnected" });
      },

      // Join (or create) a room. Leaves any previous room first.
      async joinRoom(roomName, options = {}) {
        const generation = ++joinGeneration;

        try {
          if (activeRoom) {
            await resolveGateway().leaveRoom(activeRoom, true);
            activeRoom = null;
          }

          set({
            status: "connecting",
            roomName,
            roomId: null,
            sessionId: null,
            reconnectionToken: null,
            isReconnecting: false,
            lastError: null,
          });

          const room = await resolveGateway().joinRoom(
            { roomName, options },
            createLifecycleHandlers(generation),
          );

          // Another joinRoom call arrived while we were connecting — discard this room.
          if (!onRoomConnected(room, generation)) {
            await resolveGateway().leaveRoom(room, true);
          }
        } catch (error) {
          if (generation !== joinGeneration) return;
          activeRoom = null;
          set({
            status: "error",
            ...errorFields,
            lastError: normalizeError(error, "Failed to join room"),
          });
        }
      },

      // Join a specific room by its unique ID. Leaves any previous room first.
      async joinById(roomId, options = {}) {
        const generation = ++joinGeneration;

        try {
          if (activeRoom) {
            await resolveGateway().leaveRoom(activeRoom, true);
            activeRoom = null;
          }

          set({
            status: "connecting",
            roomId,
            roomName: null,
            sessionId: null,
            reconnectionToken: null,
            isReconnecting: false,
            lastError: null,
          });

          const room = await resolveGateway().joinById(
            { roomId, options },
            createLifecycleHandlers(generation),
          );

          if (!onRoomConnected(room, generation)) {
            await resolveGateway().leaveRoom(room, true);
          }
        } catch (error) {
          if (generation !== joinGeneration) return;
          activeRoom = null;
          set({
            status: "error",
            ...errorFields,
            lastError: normalizeError(error, "Failed to join room"),
          });
        }
      },

      // Reconnect to a previously connected room using a cached token.
      // Reads token from: explicit arg → persisted localStorage → store state.
      async reconnect(explicitToken?: string) {
        const generation = ++joinGeneration;
        const persisted = loadPersistedReconnectionToken();
        const token =
          explicitToken ?? persisted?.token ?? get().reconnectionToken;

        if (!token) {
          get().setError("No reconnection token available");
          return;
        }

        set({ status: "reconnecting", isReconnecting: true, lastError: null });

        try {
          const room = await resolveGateway().reconnect(
            token,
            createLifecycleHandlers(generation),
          );

          if (!onRoomConnected(room, generation)) {
            await resolveGateway().leaveRoom(room, true);
          }
        } catch (error) {
          if (generation !== joinGeneration) return;
          clearPersistedReconnectionToken();
          activeRoom = null;
          set({
            status: "error",
            ...errorFields,
            lastError: normalizeError(error, "Failed to reconnect"),
          });
        }
      },

      // Leave the active room. Clears connection state even if the leave call fails.
      async leaveRoom() {
        if (!activeRoom) {
          set(disconnectedState);
          return;
        }

        const roomToLeave = activeRoom;
        activeRoom = null;
        joinGeneration++;
        clearPersistedReconnectionToken();

        try {
          await resolveGateway().leaveRoom(roomToLeave, true);
          set(disconnectedState);
        } catch (error) {
          set({
            status: "error",
            ...errorFields,
            lastError: normalizeError(error, "Failed to leave room"),
          });
        }
      },

      setError(message) {
        set({ status: "error", lastError: message });
      },

      // Tear down the room connection and reset all state to initial values.
      async reset() {
        await get().leaveRoom();
        gateway = null;
        set(createInitialState());
      },
    };
  });
}

export const useMatchConnectionStore = createMatchConnectionStore();
