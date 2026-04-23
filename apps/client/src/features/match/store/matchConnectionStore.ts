import { create } from "zustand";

import type {
  ColyseusRoomLike,
  JoinRoomOptions,
  RoomEventHandlers,
} from "#/infra/colyseus/connection";
import { createColyseusConnectionGateway } from "#/infra/colyseus/connection";

export type MatchConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

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

export interface MatchConnectionGateway {
  joinRoom<State = unknown, Message = unknown>(
    joinOptions: JoinRoomOptions,
    handlers?: RoomEventHandlers<State, Message>,
  ): Promise<ColyseusRoomLike<State, Message>>;
  leaveRoom(room: ColyseusRoomLike, consented?: boolean): Promise<number>;
}

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

export function createMatchConnectionStore(
  dependencies: MatchConnectionDependencies = {
    createGateway: createColyseusConnectionGateway,
  },
) {
  let gateway: MatchConnectionGateway | null = null;
  let activeRoom: ColyseusRoomLike | null = null;

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
      gateway = resolveGateway(endpoint);
      set({
        status: "disconnected",
        lastError: null,
      });
    },

    async joinRoom(roomName, options = {}) {
      if (activeRoom) {
        await resolveGateway().leaveRoom(activeRoom, true);
        activeRoom = null;
      }

      set({
        status: "connecting",
        roomName,
        roomId: null,
        sessionId: null,
        lastError: null,
      });

      try {
        const room = await resolveGateway().joinRoom(
          {
            roomName,
            options,
          },
          {
            onStateChange: (state) => {
              set({ latestState: state });
            },
            onMessage: (message) => {
              set({ latestMessage: message });
            },
            onError: (_code, message) => {
              get().setError(message ?? "Room connection error");
            },
            onLeave: () => {
              activeRoom = null;
              set({
                status: "disconnected",
                roomId: null,
                roomName: null,
                sessionId: null,
              });
            },
          },
        );

        activeRoom = room;
        set({
          status: "connected",
          roomId: room.roomId,
          roomName,
          sessionId: room.sessionId,
          lastError: null,
        });
      } catch (error) {
        activeRoom = null;
        set({
          status: "error",
          roomId: null,
          roomName: null,
          sessionId: null,
          lastError:
            error instanceof Error ? error.message : "Failed to join room",
        });
      }
    },

    async leaveRoom() {
      if (!activeRoom) {
        set({
          status: "disconnected",
          roomId: null,
          roomName: null,
          sessionId: null,
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
          lastError: null,
        });
      } catch (error) {
        set({
          status: "error",
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

    async reset() {
      await get().leaveRoom();
      gateway = null;
      set(createInitialState());
    },
  }));
}

export const useMatchConnectionStore = createMatchConnectionStore();
