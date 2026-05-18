import type { Room } from "@colyseus/sdk";
import { Client } from "@colyseus/sdk";
import type {
  CustomRoomCreation,
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

/**
 * Concrete implementation of RoomClient for the Colyseus SDK.
 *
 * @template State The Colyseus schema state.
 * @template Sent Mapping of message types that can be sent to the server.
 * @template Received Mapping of message types that can be received from the server.
 */
class ColyseusRoomAdapter<
  State,
  Sent extends MessagePayload,
  Received extends MessagePayload,
> implements RoomClient<State>
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

    const unsubLeave = this.room.onLeave((code) => {
      // 1000 is Normal Closure; higher codes imply unexpected drops
      const status =
        code > 1000 ? RoomStatus.RECONNECTING : RoomStatus.DISCONNECTED;
      callback(status);
    });

    return () => {
      unsubError.clear();
      unsubLeave.clear();
    };
  }

  getRecoveryToken(): string | null {
    return this.room.reconnectionToken || null;
  }
}

/**
 * Implementation of `NetworkProvider` for the Colyseus SDK.
 */
export class ColyseusNetworkProvider<User = unknown>
  implements NetworkProvider<User>
{
  private readonly client: Client<never, User>;
  private readonly httpEndpoint: string;

  constructor(client: Client<never, User>, httpEndpoint: string) {
    this.client = client;
    this.httpEndpoint = httpEndpoint;
  }

  /**
   * Creates a new `ColyseusNetworkProvider` instance connected to the specified WebSocket endpoint.
   *
   * @param endpoint The WebSocket endpoint of the Colyseus server.
   *
   * @returns A new instance of `ColyseusNetworkProvider` connected to the specified endpoint.
   */
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
      throw new Error(message);
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

  async createCustomRoom(): Promise<CustomRoomCreation> {
    return this.requestJson<CustomRoomCreation>("/custom-rooms", {
      method: "POST",
      body: JSON.stringify({}),
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

  async restoreSession<
    State,
    Sent extends MessagePayload,
    Received extends MessagePayload,
  >(recoveryToken: string): Promise<RoomClient<State, Sent, Received>> {
    const room = await this.client.reconnect<State>(recoveryToken);
    return new ColyseusRoomAdapter<State, Sent, Received>(room);
  }
}
