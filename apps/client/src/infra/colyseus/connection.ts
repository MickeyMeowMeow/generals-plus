import { Client } from "colyseus.js";

export const DEFAULT_COLYSEUS_ENDPOINT = "ws://localhost:2567";

export interface ColyseusRoomLike<State = unknown, Message = unknown> {
  roomId: string;
  sessionId: string;
  leave(consented?: boolean): Promise<number>;
  onStateChange(callback: (state: State) => void): void;
  onMessage(callback: (message: Message) => void): void;
  onError(callback: (code: number, message?: string) => void): void;
  onLeave(callback: (code: number) => void): void;
}

export interface ColyseusClientLike {
  joinOrCreate<State = unknown, Message = unknown>(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<ColyseusRoomLike<State, Message>>;
}

export interface RoomEventHandlers<State = unknown, Message = unknown> {
  onStateChange?: (state: State) => void;
  onMessage?: (message: Message) => void;
  onError?: (code: number, message?: string) => void;
  onLeave?: (code: number) => void;
}

export interface JoinRoomOptions {
  roomName: string;
  options?: Record<string, unknown>;
}

export function resolveColyseusEndpoint(
  env: { VITE_COLYSEUS_ENDPOINT?: string } = import.meta.env,
): string {
  const endpoint = env.VITE_COLYSEUS_ENDPOINT?.trim();
  return endpoint && endpoint.length > 0 ? endpoint : DEFAULT_COLYSEUS_ENDPOINT;
}

export function createColyseusClient(
  endpoint = resolveColyseusEndpoint(),
): ColyseusClientLike {
  return new Client(endpoint);
}

export class ColyseusConnectionGateway {
  constructor(private readonly client: ColyseusClientLike) {}

  async joinRoom<State = unknown, Message = unknown>(
    joinOptions: JoinRoomOptions,
    handlers: RoomEventHandlers<State, Message> = {},
  ): Promise<ColyseusRoomLike<State, Message>> {
    const room = await this.client.joinOrCreate<State, Message>(
      joinOptions.roomName,
      joinOptions.options ?? {},
    );

    if (handlers.onStateChange) {
      room.onStateChange(handlers.onStateChange);
    }

    if (handlers.onMessage) {
      room.onMessage(handlers.onMessage);
    }

    if (handlers.onError) {
      room.onError(handlers.onError);
    }

    if (handlers.onLeave) {
      room.onLeave(handlers.onLeave);
    }

    return room;
  }

  async leaveRoom(room: ColyseusRoomLike, consented = true): Promise<number> {
    return room.leave(consented);
  }
}

export function createColyseusConnectionGateway(
  endpoint?: string,
): ColyseusConnectionGateway {
  return new ColyseusConnectionGateway(createColyseusClient(endpoint));
}
