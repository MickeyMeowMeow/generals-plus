import type {
  CustomRoomCreation,
  CustomRoomResolution,
  MessagePayload,
  SeatReservation,
} from "@generals-plus/shared-types";

import type { AuthData } from "#/infra/network/auth";
import type { RoomClient } from "#/infra/network/room";
import type { UnsubscribeFn } from "#/infra/network/types";

/**
 * Entry point for managing network sessions and authentication.
 *
 * @template User The shape of the authenticated user data returned by the server.
 */
export interface NetworkProvider<User = unknown> {
  /**
   * Performs an email/password sign-in to the server.
   *
   * @param email The user's email address.
   * @param password The user's raw password.
   *
   * @returns A promise that resolves to authentication data.
   */
  signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<AuthData<User>>;

  /**
   * Registers a new user with email/password and optional profile data.
   *
   * @param email The user's email address.
   * @param password The user's raw password.
   * @param options Optional account profile data to persist with the user.
   *
   * @returns A promise that resolves to authentication data.
   */
  registerWithEmailAndPassword(
    email: string,
    password: string,
    options?: Record<string, unknown>,
  ): Promise<AuthData<User>>;

  /**
   * Performs an anonymous sign-in to the server.
   *
   * @param options Optional parameters for the sign-in process.
   *
   * @returns A promise that resolves to authentication data.
   */
  signInAnonymously(options?: Record<string, unknown>): Promise<AuthData<User>>;

  /**
   * Performs a sign-out operation, invalidating the current session and token.
   */
  signOut(): Promise<void>;

  /**
   * Fetches the authenticated user's data from the server.
   *
   * @returns A promise that resolves to the user data.
   */
  getUserData(): Promise<User>;

  /**
   * Retrieves the current authentication token, if available.
   *
   * @returns The authentication token or null if not authenticated.
   */
  getAuthToken(): string | null;

  /**
   * Subscribes to authentication state changes.
   *
   * @param callback Executed whenever the authentication state changes, receiving the new auth data.
   *
   * @returns Unsubscribe function to stop listening for auth changes.
   */
  onAuthChange<User = unknown>(
    callback: (response: AuthData<User>) => void,
  ): UnsubscribeFn;

  /**
   * Attempts to enter a room or create a new instance if none exist.
   *
   * @template State The structure of the synchronized game state.
   * @template Sent Map of messages the client is permitted to send.
   * @template Received Map of messages the client expects to receive.
   *
   * @param roomName The registered name of the room type to join or create.
   * @param options Initialization parameters for the room.
   *
   * @returns A promise that resolves to a RoomClient instance upon successful connection.
   */
  joinOrCreate<
    State,
    Sent extends MessagePayload,
    Received extends MessagePayload,
  >(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<RoomClient<State, Sent, Received>>;

  /**
   * Attempts to join an existing room instance by its name.
   *
   * @template State The structure of the synchronized game state.
   * @template Sent Map of messages the client is permitted to send.
   * @template Received Map of messages the client expects to receive.
   *
   * @param roomName The registered name of the room type to join.
   * @param options Optional parameters for joining the room.
   *
   * @returns A promise that resolves to a RoomClient instance upon successful connection.
   */
  join<
    State,
    Sent extends MessagePayload = MessagePayload,
    Received extends MessagePayload = MessagePayload,
  >(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<RoomClient<State, Sent, Received>>;

  /**
   * Connects to a specific room instance by its unique ID.
   *
   * @template State The structure of the synchronized game state.
   * @template Sent Map of messages the client is permitted to send.
   * @template Received Map of messages the client expects to receive.
   *
   * @param roomId The unique identifier of the room instance to join.
   * @param options Optional parameters for joining the room.
   *
   * @returns A promise that resolves to a RoomClient instance upon successful connection.
   */
  joinById<State, Sent extends MessagePayload, Received extends MessagePayload>(
    roomId: string,
    options?: Record<string, unknown>,
  ): Promise<RoomClient<State, Sent, Received>>;

  consumeSeatReservation<
    State,
    Sent extends MessagePayload,
    Received extends MessagePayload,
  >(
    seatReservation: SeatReservation,
  ): Promise<RoomClient<State, Sent, Received>>;

  /**
   * Creates a new room instance with the specified name and options.
   *
   * @template State The structure of the synchronized game state.
   * @template Sent Map of messages the client is permitted to send.
   * @template Received Map of messages the client expects to receive.
   *
   * @param roomName The registered name of the room type to create.
   * @param options Initialization parameters for the room.
   *
   * @returns A promise that resolves to a RoomClient instance upon successful creation and connection.
   */
  create<State, Sent extends MessagePayload, Received extends MessagePayload>(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<RoomClient<State, Sent, Received>>;

  createCustomRoom(): Promise<CustomRoomCreation>;

  resolveCustomRoom(customRoomKey: string): Promise<CustomRoomResolution>;
}
