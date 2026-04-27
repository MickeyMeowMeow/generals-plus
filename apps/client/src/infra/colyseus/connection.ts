import { Callbacks, Client } from "@colyseus/sdk";

export { Callbacks };

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
  getUserData<UserResolved = User>(): Promise<{ user: UserResolved }>;
  signInAnonymously(
    options?: Record<string, unknown>,
  ): Promise<ColyseusAuthData<User>>;
  signOut(): Promise<void>;
}

// Subscription from SDK signal events (onError, onLeave, onDrop, etc.).
// The SDK's createSignal returns EventEmitter which exposes clear() for cleanup.
export interface ColyseusSignalSubscription {
  clear(): void;
}

// Subscription from SDK message events (onMessage).
// The SDK's nanoevents .on() returns a plain unsubscribe function.
export type ColyseusMessageSubscription = () => void;

// Reconnection configuration exposed on each room instance by the SDK.
export interface ReconnectionOptions {
  enabled: boolean;
  maxRetries: number;
  minDelay: number;
  maxDelay: number;
  minUptime: number;
  delay: number;
  backoff: (attempt: number, delay: number) => number;
  maxEnqueuedMessages: number;
  enqueuedMessages: Array<{ data: Uint8Array }>;
  retryCount: number;
  isReconnecting: boolean;
}

// Room interface matching @colyseus/sdk 0.17 Room surface, decoupled for testing.
export interface ColyseusRoom<State = unknown, Message = unknown> {
  roomId: string;
  name: string;
  sessionId: string;
  reconnectionToken: string;
  reconnection: ReconnectionOptions;
  readonly state: State;

  leave(consented?: boolean): Promise<number>;
  send(type: string | number, message?: unknown): void;
  sendBytes(type: string | number, bytes: Uint8Array): void;
  sendUnreliable(type: string | number, message?: unknown): void;
  ping(callback: (ms: number) => void): void;
  removeAllListeners(): void;

  onStateChange(callback: (state: State) => void): ColyseusSignalSubscription;
  onMessage(
    type: string | number,
    callback: (message: Message) => void,
  ): ColyseusMessageSubscription;
  onError(
    callback: (code: number, message?: string) => void,
  ): ColyseusSignalSubscription;
  onLeave(
    callback: (code: number, reason?: string) => void,
  ): ColyseusSignalSubscription;
  onDrop(
    callback: (code: number, reason?: string) => void,
  ): ColyseusSignalSubscription;
  onReconnect(callback: () => void): ColyseusSignalSubscription;
}

// Abstraction over the Colyseus client, exposing auth and room operations.
export interface ColyseusClient {
  auth: ColyseusAuth;
  http: unknown;
  joinOrCreate<State = unknown, Message = unknown>(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<ColyseusRoom<State, Message>>;
  joinById<State = unknown, Message = unknown>(
    roomId: string,
    options?: Record<string, unknown>,
  ): Promise<ColyseusRoom<State, Message>>;
  create<State = unknown, Message = unknown>(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<ColyseusRoom<State, Message>>;
  join<State = unknown, Message = unknown>(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<ColyseusRoom<State, Message>>;
  reconnect<State = unknown, Message = unknown>(
    reconnectionToken: string,
  ): Promise<ColyseusRoom<State, Message>>;
  consumeSeatReservation<State = unknown, Message = unknown>(
    reservation: unknown,
  ): Promise<ColyseusRoom<State, Message>>;
  getLatency(options?: { pingCount?: number }): Promise<number>;
}

// Lifecycle-only callbacks forwarded to a room after joining.
// State observation uses Callbacks.get(room). Messages use room.onMessage().
export interface RoomLifecycleHandlers {
  onError?: (code: number, message?: string) => void;
  onLeave?: (code: number, reason?: string) => void;
  onDrop?: (code: number, reason?: string) => void;
  onReconnect?: () => void;
}

// Parameters for a join-or-create room request.
export interface JoinRoomOptions {
  roomName: string;
  options?: Record<string, unknown>;
}

// Parameters for joining a specific room by its unique ID.
export interface JoinByIdOptions {
  roomId: string;
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
  return new Client(endpoint) as ColyseusClient;
}

// Facade over a Colyseus client that wires only lifecycle events.
export class ColyseusConnectionGateway {
  private readonly client: ColyseusClient;
  private activeSubscriptions: Array<ColyseusSignalSubscription> = [];

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
    const response = await this.client.auth.getUserData();
    return response.user as User;
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

  async joinRoom<State = unknown, Message = unknown>(
    joinOptions: JoinRoomOptions,
    handlers: RoomLifecycleHandlers = {},
  ): Promise<ColyseusRoom<State, Message>> {
    const room = await this.client.joinOrCreate<State, Message>(
      joinOptions.roomName,
      joinOptions.options ?? {},
    );

    this.wireLifecycleHandlers(room, handlers);
    return room;
  }

  async joinById<State = unknown, Message = unknown>(
    joinOptions: JoinByIdOptions,
    handlers: RoomLifecycleHandlers = {},
  ): Promise<ColyseusRoom<State, Message>> {
    const room = await this.client.joinById<State, Message>(
      joinOptions.roomId,
      joinOptions.options ?? {},
    );

    this.wireLifecycleHandlers(room, handlers);
    return room;
  }

  async reconnect<State = unknown, Message = unknown>(
    reconnectionToken: string,
    handlers: RoomLifecycleHandlers = {},
  ): Promise<ColyseusRoom<State, Message>> {
    const room = await this.client.reconnect<State, Message>(reconnectionToken);
    this.wireLifecycleHandlers(room, handlers);
    return room;
  }

  private wireLifecycleHandlers<State, Message>(
    room: ColyseusRoom<State, Message>,
    handlers: RoomLifecycleHandlers,
  ): void {
    this.unsubscribeHandlers();

    if (handlers.onError) {
      this.activeSubscriptions.push(room.onError(handlers.onError));
    }
    if (handlers.onLeave) {
      this.activeSubscriptions.push(room.onLeave(handlers.onLeave));
    }
    if (handlers.onDrop) {
      this.activeSubscriptions.push(room.onDrop(handlers.onDrop));
    }
    if (handlers.onReconnect) {
      this.activeSubscriptions.push(room.onReconnect(handlers.onReconnect));
    }
  }

  unsubscribeHandlers(): void {
    for (const sub of this.activeSubscriptions) {
      sub.clear();
    }
    this.activeSubscriptions = [];
  }

  async leaveRoom(room: ColyseusRoom, consented = true): Promise<number> {
    this.unsubscribeHandlers();
    return room.leave(consented);
  }
}

export function createColyseusConnectionGateway(
  endpoint?: string,
): ColyseusConnectionGateway {
  return new ColyseusConnectionGateway(createColyseusClient(endpoint));
}

const sharedGatewayByEndpoint = new Map<string, ColyseusConnectionGateway>();

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

export function resetSharedColyseusConnectionGatewayForTesting(): void {
  sharedGatewayByEndpoint.clear();
}
