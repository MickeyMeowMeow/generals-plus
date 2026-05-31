import { Callbacks, Client } from "@colyseus/sdk";

export { Callbacks };

export const DEFAULT_COLYSEUS_ENDPOINT = "http://localhost:2567";

export interface ColyseusAuthData<User = unknown> {
  user: User | null;
  token: string | null;
}

export interface ColyseusAuth<User = unknown> {
  token: string | null | undefined;
  onChange(callback: (response: ColyseusAuthData<User>) => void): () => void;
  getUserData<UserResolved = User>(): Promise<{ user: UserResolved }>;
  signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<ColyseusAuthData<User>>;
  registerWithEmailAndPassword(
    email: string,
    password: string,
    options?: Record<string, unknown>,
  ): Promise<ColyseusAuthData<User>>;
  signInAnonymously(
    options?: Record<string, unknown>,
  ): Promise<ColyseusAuthData<User>>;
  signOut(): Promise<void>;
}

export interface ColyseusSignalSubscription {
  clear(): void;
}

export type ColyseusMessageSubscription = () => void;

export interface ColyseusRoom<State = unknown, Message = unknown> {
  roomId: string;
  name: string;
  sessionId: string;
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
}

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
  consumeSeatReservation<State = unknown, Message = unknown>(
    reservation: unknown,
  ): Promise<ColyseusRoom<State, Message>>;
  getLatency(options?: { pingCount?: number }): Promise<number>;
}

export interface RoomLifecycleHandlers {
  onError?: (code: number, message?: string) => void;
  onLeave?: (code: number, reason?: string) => void;
}

export interface JoinRoomOptions {
  roomName: string;
  options?: Record<string, unknown>;
}

export interface JoinByIdOptions {
  roomId: string;
  options?: Record<string, unknown>;
}

export function resolveColyseusEndpoint(
  env: Record<string, string | undefined> = import.meta.env as Record<
    string,
    string | undefined
  >,
): string {
  const endpoint = env.VITE_COLYSEUS_ENDPOINT?.trim();
  return endpoint && endpoint.length > 0 ? endpoint : DEFAULT_COLYSEUS_ENDPOINT;
}

export function createColyseusClient(
  endpoint = resolveColyseusEndpoint(),
): ColyseusClient {
  return new Client(endpoint) as ColyseusClient;
}

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

  async signInWithEmailAndPassword<User = unknown>(
    email: string,
    password: string,
  ): Promise<ColyseusAuthData<User>> {
    return this.client.auth.signInWithEmailAndPassword(
      email,
      password,
    ) as Promise<ColyseusAuthData<User>>;
  }

  async registerWithEmailAndPassword<User = unknown>(
    email: string,
    password: string,
    options: Record<string, unknown> = {},
  ): Promise<ColyseusAuthData<User>> {
    return this.client.auth.registerWithEmailAndPassword(
      email,
      password,
      options,
    ) as Promise<ColyseusAuthData<User>>;
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
