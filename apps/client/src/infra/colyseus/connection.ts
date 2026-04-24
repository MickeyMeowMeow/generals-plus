import { Client } from "colyseus.js";

export const DEFAULT_COLYSEUS_ENDPOINT = "ws://localhost:2567";

// Shape of the auth response emitted by Colyseus on sign-in and session changes.
export interface ColyseusAuthData<User = unknown> {
  user: User | null;
  token: string | null;
}

// Subset of the Colyseus auth API used by the app, decoupled from the real SDK for testing.
export interface ColyseusAuth<User = unknown> {
  token: string | null | undefined;
  onChange(callback: (response: ColyseusAuthData<User>) => void): () => void;
  getUserData(): Promise<User>;
  signInAnonymously(
    options?: Record<string, unknown>,
  ): Promise<ColyseusAuthData<User>>;
  signOut(): Promise<void>;
}

// Minimal room interface representing an active Colyseus room session.
export interface ColyseusRoom<State = unknown, Message = unknown> {
  roomId: string;
  sessionId: string;
  leave(consented?: boolean): Promise<number>;
  onStateChange(callback: (state: State) => void): void;
  onMessage(
    type: string | number,
    callback: (message: Message) => void,
  ): unknown;
  onError(callback: (code: number, message?: string) => void): void;
  onLeave(callback: (code: number) => void): void;
}

// Abstraction over the Colyseus client, exposing auth and room operations.
export interface ColyseusClient {
  auth: ColyseusAuth;
  joinOrCreate<State = unknown, Message = unknown>(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<ColyseusRoom<State, Message>>;
}

// Optional callbacks forwarded to a room after joining.
// messageHandlers is an array of {type, handler} pairs because Colyseus 0.16
// requires registering each message type individually — no client-side wildcard.
export interface RoomEventHandlers<State = unknown, Message = unknown> {
  onStateChange?: (state: State) => void;
  messageHandlers?: ReadonlyArray<{
    type: string | number;
    handler: (message: Message) => void;
  }>;
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
): ColyseusClient {
  return new Client(endpoint);
}

// Facade over a Colyseus client that implements both UserAuthGateway and MatchConnectionGateway.
export class ColyseusConnectionGateway {
  private readonly client: ColyseusClient;

  constructor(client: ColyseusClient) {
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
  ): Promise<ColyseusRoom<State, Message>> {
    const room = await this.client.joinOrCreate<State, Message>(
      joinOptions.roomName,
      joinOptions.options ?? {},
    );

    if (handlers.onStateChange) {
      room.onStateChange(handlers.onStateChange);
    }

    if (handlers.messageHandlers) {
      for (const { type, handler } of handlers.messageHandlers) {
        room.onMessage(type, handler);
      }
    }

    if (handlers.onError) {
      room.onError(handlers.onError);
    }

    if (handlers.onLeave) {
      room.onLeave(handlers.onLeave);
    }

    return room;
  }

  async leaveRoom(room: ColyseusRoom, consented = true): Promise<number> {
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
// Normalizes whitespace and falls back to the default endpoint when empty.
export function createSharedColyseusConnectionGateway(
  endpoint = resolveColyseusEndpoint(),
): ColyseusConnectionGateway {
  const normalized = endpoint.trim() || resolveColyseusEndpoint();
  const existingGateway = sharedGatewayByEndpoint.get(normalized);
  if (existingGateway) {
    return existingGateway;
  }

  const gateway = createColyseusConnectionGateway(normalized);
  sharedGatewayByEndpoint.set(normalized, gateway);
  return gateway;
}

// Clear the shared gateway cache — intended for use between test runs only.
export function resetSharedColyseusConnectionGatewayForTesting(): void {
  sharedGatewayByEndpoint.clear();
}
