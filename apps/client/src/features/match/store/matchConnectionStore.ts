import { create } from "zustand";

import type {
  ColyseusRoomLike,
  JoinRoomOptions,
  RoomEventHandlers,
} from "#/infra/colyseus/connection";
import { createSharedColyseusConnectionGateway } from "#/infra/colyseus/connection";

// State machine for the match room connection lifecycle:
// idle → connecting → connected → disconnected
// Any stage can transition to error.
export type MatchConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

// Zustand store shape for match room connection state and actions.
export interface MatchConnectionStore {
  status: MatchConnectionStatus;
  roomId: string | null;
  roomName: string | null;
  sessionId: string | null;
  latestState: unknown;
  latestMessage: unknown;
  lastError: string | null;
  connect: (endpoint?: string) => void;
  joinRoom: (
    roomName: string,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setError: (message: string) => void;
  reset: () => Promise<void>;
}

// Abstraction over Colyseus room operations, allowing tests to inject fakes.
export interface MatchConnectionGateway {
  joinRoom<State = unknown, Message = unknown>(
    joinOptions: JoinRoomOptions,
    handlers?: RoomEventHandlers<State, Message>,
  ): Promise<ColyseusRoomLike<State, Message>>;
  leaveRoom(room: ColyseusRoomLike, consented?: boolean): Promise<number>;
}

// Factory dependencies injected into the store for testability.
export interface MatchConnectionDependencies {
  createGateway: (endpoint?: string) => MatchConnectionGateway;
}

const createInitialState = (): Omit<
  MatchConnectionStore,
  "connect" | "joinRoom" | "leaveRoom" | "setError" | "reset"
> => ({
  status: "idle",
  roomId: null,
  roomName: null,
  sessionId: null,
  latestState: null,
  latestMessage: null,
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
  let activeRoom: ColyseusRoomLike | null = null;
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

  return create<MatchConnectionStore>()((set, get) => ({
    ...createInitialState(),

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
      set({
        ...createInitialState(),
        status: "disconnected",
      });
    },

    // Join (or create) a room. Leaves any previous room first.
    // Uses a generation counter to discard stale callbacks from previous rooms.
    async joinRoom(roomName, options = {}) {
      const generation = ++joinGeneration;

      try {
        // Leave the current room before joining a new one.
        if (activeRoom) {
          await resolveGateway().leaveRoom(activeRoom, true);
          activeRoom = null;
        }

        set({
          status: "connecting",
          roomName,
          roomId: null,
          sessionId: null,
          latestState: null,
          latestMessage: null,
          lastError: null,
        });

        const room = await resolveGateway().joinRoom(
          {
            roomName,
            options,
          },
          {
            onStateChange: (state) => {
              if (generation !== joinGeneration) return;
              set({ latestState: state });
            },
            // Register specific message type handlers when the game protocol is defined.
            // Colyseus 0.16 requires per-type registration — no client-side wildcard.
            onError: (_code, message) => {
              if (generation !== joinGeneration) return;
              get().setError(message ?? "Room connection error");
            },
            onLeave: () => {
              if (generation !== joinGeneration) return;
              activeRoom = null;
              set({
                status: "disconnected",
                roomId: null,
                roomName: null,
                sessionId: null,
                latestState: null,
                latestMessage: null,
              });
            },
          },
        );

        // Another joinRoom call arrived while we were connecting — discard this room.
        if (generation !== joinGeneration) {
          await resolveGateway().leaveRoom(room, true);
          return;
        }

        activeRoom = room;
        set({
          status: "connected",
          roomId: room.roomId,
          roomName,
          sessionId: room.sessionId,
          lastError: null,
        });
      } catch (error) {
        if (generation !== joinGeneration) return;
        activeRoom = null;
        set({
          status: "error",
          roomId: null,
          roomName: null,
          sessionId: null,
          latestState: null,
          latestMessage: null,
          lastError:
            error instanceof Error ? error.message : "Failed to join room",
        });
      }
    },

    // Leave the active room. Clears connection state even if the leave call fails.
    async leaveRoom() {
      if (!activeRoom) {
        set({
          status: "disconnected",
          roomId: null,
          roomName: null,
          sessionId: null,
          latestState: null,
          latestMessage: null,
          lastError: null,
        });
        return;
      }

      const roomToLeave = activeRoom;
      activeRoom = null;

      try {
        await resolveGateway().leaveRoom(roomToLeave, true);
        set({
          status: "disconnected",
          roomId: null,
          roomName: null,
          sessionId: null,
          latestState: null,
          latestMessage: null,
          lastError: null,
        });
      } catch (error) {
        set({
          status: "error",
          roomId: null,
          roomName: null,
          sessionId: null,
          latestState: null,
          latestMessage: null,
          lastError:
            error instanceof Error ? error.message : "Failed to leave room",
        });
      }
    },

    setError(message) {
      set({
        status: "error",
        lastError: message,
      });
    },

    // Tear down the room connection and reset all state to initial values.
    async reset() {
      await get().leaveRoom();
      gateway = null;
      set(createInitialState());
    },
  }));
}

export const useMatchConnectionStore = createMatchConnectionStore();
