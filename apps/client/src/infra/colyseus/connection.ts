import { Client } from "colyseus.js";

export const DEFAULT_COLYSEUS_ENDPOINT = "ws://localhost:2567";

// Shape of the auth response emitted by Colyseus on sign-in and session changes.
export interface ColyseusAuthData<User = unknown> {
  user: User;
  token: string | null;
}

// Subset of the Colyseus auth API used by the app, decoupled from the real SDK for testing.
export interface ColyseusAuthLike<User = unknown> {
  token: string | null | undefined;
  onChange(callback: (response: ColyseusAuthData<User>) => void): () => void;
  getUserData(): Promise<User>;
  signInAnonymously(
    options?: Record<string, unknown>,
  ): Promise<ColyseusAuthData<User>>;
  signOut(): Promise<void>;
}

// Minimal room interface representing an active Colyseus room session.
export interface ColyseusRoomLike<State = unknown, Message = unknown> {
  roomId: string;
  sessionId: string;
  leave(consented?: boolean): Promise<number>;
  onStateChange(callback: (state: State) => void): void;
  onMessage(
    type: string | number,
    callback: (message: Message) => void,
  ): unknown;
  onMessage(
    type: "*",
    callback: (type: string | number, message: Message) => void,
  ): unknown;
  onError(callback: (code: number, message?: string) => void): void;
  onLeave(callback: (code: number) => void): void;
}

// Abstraction over the Colyseus client, exposing auth and room operations.
export interface ColyseusClientLike {
  auth: ColyseusAuthLike;
  joinOrCreate<State = unknown, Message = unknown>(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<ColyseusRoomLike<State, Message>>;
}

// Optional callbacks forwarded to a room after joining.
export interface RoomEventHandlers<State = unknown, Message = unknown> {
  onStateChange?: (state: State) => void;
  onMessage?: (type: string | number, message: Message) => void;
  onError?: (code: number, message?: string) => void;
  onLeave?: (code: number) => void;
}

// Parameters for a join-or-create room request.
export interface JoinRoomOptions {
  roomName: string;
  options?: Record<string, unknown>;
}

// Resolve the Colyseus server endpoint from the environment, falling back to the default.
export function resolveColyseusEndpoint(
  env: Record<string, string | undefined> = import.meta.env as Record<
    string,
    string | undefined
  >,
): string {
  const endpoint = env.VITE_COLYSEUS_ENDPOINT?.trim();
  return endpoint && endpoint.length > 0 ? endpoint : DEFAULT_COLYSEUS_ENDPOINT;
}

// Create a raw Colyseus client wrapping the SDK constructor.
export function createColyseusClient(
  endpoint = resolveColyseusEndpoint(),
): ColyseusClientLike {
  return new Client(endpoint);
}

// Facade over a Colyseus client that implements both UserAuthGateway and MatchConnectionGateway.
export class ColyseusConnectionGateway {
  private readonly client: ColyseusClientLike;

  constructor(client: ColyseusClientLike) {
    this.client = client;
  }

  onAuthChange<User = unknown>(
    callback: (response: ColyseusAuthData<User>) => void,
  ): () => void {
    return this.client.auth.onChange(
      callback as (response: ColyseusAuthData<unknown>) => void,
    );
  }

  async getUserData<User = unknown>(): Promise<User> {
    return this.client.auth.getUserData() as Promise<User>;
  }

  async signInAnonymously<User = unknown>(
    options: Record<string, unknown> = {},
  ): Promise<ColyseusAuthData<User>> {
    return this.client.auth.signInAnonymously(options) as Promise<
      ColyseusAuthData<User>
    >;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  getAuthToken(): string | null {
    return this.client.auth.token ?? null;
  }

  // Join or create a room, then wire up optional lifecycle handlers.
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
      room.onMessage("*", handlers.onMessage);
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

// Cache of gateway instances keyed by endpoint to avoid duplicate client connections.
const sharedGatewayByEndpoint = new Map<string, ColyseusConnectionGateway>();

// Return a cached gateway for the given endpoint, creating one on first access.
export function createSharedColyseusConnectionGateway(
  endpoint = resolveColyseusEndpoint(),
): ColyseusConnectionGateway {
  const existingGateway = sharedGatewayByEndpoint.get(endpoint);
  if (existingGateway) {
    return existingGateway;
  }

  const gateway = createColyseusConnectionGateway(endpoint);
  sharedGatewayByEndpoint.set(endpoint, gateway);
  return gateway;
}

// Clear the shared gateway cache — intended for use between test runs only.
export function resetSharedColyseusConnectionGatewayForTesting(): void {
  sharedGatewayByEndpoint.clear();
}
