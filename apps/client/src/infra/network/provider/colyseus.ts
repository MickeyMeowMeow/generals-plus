import type { Room } from "@colyseus/sdk";
import { Client } from "@colyseus/sdk";
import type {
  CustomRoomCreation,
  CustomRoomCreationRequest,
  CustomRoomResolution,
  ExtractMessageKey,
  MessagePayload,
  SeatReservation,
} from "@generals-plus/shared-types";

import type { AuthData } from "#/infra/network/auth";
import type { NetworkProvider } from "#/infra/network/provider/interfaces";
import type { RoomClient } from "#/infra/network/room";
import { RoomStatus } from "#/infra/network/room";
import type { UnsubscribeFn } from "#/infra/network/types";

export class HttpRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpRequestError";
    this.status = status;
  }
}

class ColyseusRoomAdapter<
  State,
  Sent extends MessagePayload,
  Received extends MessagePayload,
> implements RoomClient<State, Sent, Received>
{
  private readonly room: Room<unknown, State>;

  constructor(room: Room<unknown, State>) {
    this.room = room;
  }

  get roomId(): string {
    return this.room.roomId;
  }

  get sessionId(): string {
    return this.room.sessionId;
  }

  get state(): State {
    return this.room.state;
  }

  send<K extends ExtractMessageKey<Sent>>(type: K, message?: Sent[K]): void {
    this.room.send(type, message);
  }

  async leave(consented = true): Promise<void> {
    this.room.removeAllListeners();
    await this.room.leave(consented);
  }

  onStateChange(callback: (state: State) => void): UnsubscribeFn {
    const signal = this.room.onStateChange(callback);
    return () => signal.clear();
  }

  onMessage<K extends ExtractMessageKey<Received>>(
    type: K,
    callback: (payload: Received[K]) => void,
  ): UnsubscribeFn {
    return this.room.onMessage(type, callback);
  }

  onStatusChange(
    callback: (status: RoomStatus, details?: string) => void,
  ): UnsubscribeFn {
    const unsubError = this.room.onError((code, message) =>
      callback(RoomStatus.ERROR, `[${code}] ${message}`),
    );

    const unsubLeave = this.room.onLeave((_code, reason) => {
      callback(RoomStatus.DISCONNECTED, reason);
    });

    return () => {
      unsubError.clear();
      unsubLeave.clear();
    };
  }

  onError(callback: (code: number, message?: string) => void): UnsubscribeFn {
    const signal = this.room.onError(callback);
    return () => signal.clear();
  }

  onLeave(callback: (code: number, reason?: string) => void): UnsubscribeFn {
    const signal = this.room.onLeave(callback);
    return () => signal.clear();
  }
}

export class ColyseusNetworkProvider<User = unknown>
  implements NetworkProvider<User>
{
  private readonly client: Client<never, User>;
  private readonly httpEndpoint: string;

  constructor(client: Client<never, User>, httpEndpoint: string) {
    this.client = client;
    this.httpEndpoint = httpEndpoint;
  }

  static fromEndpoint<User = unknown>(
    endpoint: string,
  ): ColyseusNetworkProvider<User> {
    return new ColyseusNetworkProvider<User>(
      new Client<never, User>(endpoint),
      endpoint.replace(/^ws/i, "http"),
    );
  }

  private async requestJson<Response>(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const token = this.getAuthToken();
    const response = await fetch(new URL(path, this.httpEndpoint), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = (await response.json()) as { error?: string };
        message = payload.error ?? message;
      } catch {
        // Ignore non-JSON error bodies.
      }
      throw new HttpRequestError(response.status, message);
    }

    return (await response.json()) as Response;
  }

  async signInAnonymously(
    options?: Record<string, unknown>,
  ): Promise<AuthData<User>> {
    return this.client.auth.signInAnonymously(options);
  }

  async signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<AuthData<User>> {
    return this.client.auth.signInWithEmailAndPassword(email, password);
  }

  async registerWithEmailAndPassword(
    email: string,
    password: string,
    options?: Record<string, unknown>,
  ): Promise<AuthData<User>> {
    return this.client.auth.registerWithEmailAndPassword(
      email,
      password,
      options,
    );
  }

  async signOut(): Promise<void> {
    return this.client.auth.signOut();
  }

  async getUserData(): Promise<User> {
    return this.client.auth.getUserData().then((response) => response.user);
  }

  getAuthToken(): string | null {
    return this.client.auth.token ?? null;
  }

  onAuthChange<User = unknown>(
    callback: (response: AuthData<User>) => void,
  ): UnsubscribeFn {
    return this.client.auth.onChange(callback);
  }

  async joinOrCreate<
    State,
    Sent extends MessagePayload,
    Received extends MessagePayload,
  >(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<RoomClient<State, Sent, Received>> {
    const room = await this.client.joinOrCreate<State>(roomName, options);
    return new ColyseusRoomAdapter<State, Sent, Received>(room);
  }

  async join<
    State,
    Sent extends MessagePayload = MessagePayload,
    Received extends MessagePayload = MessagePayload,
  >(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<RoomClient<State, Sent, Received>> {
    const room = await this.client.join<State>(roomName, options);
    return new ColyseusRoomAdapter<State, Sent, Received>(room);
  }

  async joinById<
    State,
    Sent extends MessagePayload,
    Received extends MessagePayload,
  >(
    roomId: string,
    options?: Record<string, unknown>,
  ): Promise<RoomClient<State, Sent, Received>> {
    const room = await this.client.joinById<State>(roomId, options);
    return new ColyseusRoomAdapter<State, Sent, Received>(room);
  }

  async consumeSeatReservation<
    State,
    Sent extends MessagePayload,
    Received extends MessagePayload,
  >(
    seatReservation: SeatReservation,
  ): Promise<RoomClient<State, Sent, Received>> {
    const room =
      await this.client.consumeSeatReservation<State>(seatReservation);
    return new ColyseusRoomAdapter<State, Sent, Received>(room);
  }

  async create<
    State,
    Sent extends MessagePayload,
    Received extends MessagePayload,
  >(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<RoomClient<State, Sent, Received>> {
    const room = await this.client.create<State>(roomName, options);
    return new ColyseusRoomAdapter<State, Sent, Received>(room);
  }

  async createCustomRoom(customRoomKey?: string): Promise<CustomRoomCreation> {
    const payload: CustomRoomCreationRequest = {};
    if (customRoomKey?.trim()) {
      payload.customRoomKey = customRoomKey.trim();
    }
    return this.requestJson<CustomRoomCreation>("/custom-rooms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async resolveCustomRoom(
    customRoomKey: string,
  ): Promise<CustomRoomResolution> {
    return this.requestJson<CustomRoomResolution>(
      `/custom-rooms/${encodeURIComponent(customRoomKey)}/resolve`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  }

  async checkAiHealth(): Promise<boolean> {
    try {
      const result = await this.requestJson<{ available: boolean }>(
        "/ai/health",
      );
      return result.available === true;
    } catch {
      return false;
    }
  }
}
