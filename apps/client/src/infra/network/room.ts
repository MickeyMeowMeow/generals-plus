import type {
  ExtractMessageKey,
  MessagePayload,
} from "@generals-plus/shared-types";

import type { UnsubscribeFn } from "#/infra/network/types";

/**
 * Lifecycle events for any network room.
 */
export const RoomStatus = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
} as const;

export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

/**
 * Represents an active connection to a multiplayer match.
 *
 * @template State The shape of the synchronized game state.
 * @template Sent Mapping of message types that can be sent to the server.
 * @template Received Mapping of message types that can be received from the server.
 */
export interface RoomClient<
  State = unknown,
  Sent extends MessagePayload = MessagePayload,
  Received extends MessagePayload = MessagePayload,
> {
  readonly roomId: string;
  readonly sessionId: string;
  readonly state: State;

  /**
   * Transmits a message to the server.
   *
   * @param type Identifier for the message type.
   * @param message Data payload to transmit.
   */
  send<K extends ExtractMessageKey<Sent>>(type: K, message?: Sent[K]): void;

  /**
   * Disconnects from the room.
   *
   * @param consented Whether the leave is intentional (true) or a forced drop (false).
   */
  leave(consented?: boolean): Promise<void>;

  /**
   * Listens for full state synchronization updates.
   *
   * @param callback Executed whenever the remote state changes.
   * @returns Unsubscribe function.
   */
  onStateChange(callback: (state: State) => void): UnsubscribeFn;

  /**
   * Listens for transient messages from the server.
   *
   * @param type Message identifier to listen for.
   * @param callback Executed when a matching message arrives.
   * @returns Unsubscribe function.
   */
  onMessage<K extends ExtractMessageKey<Received>>(
    type: K,
    callback: (payload: Received[K]) => void,
  ): UnsubscribeFn;

  /**
   * Observes the health and status of the connection.
   *
   * @param callback Executed on connection drops, errors, or successful reconnections.
   * @returns Unsubscribe function.
   */
  onStatusChange(
    callback: (status: RoomStatus, details?: string) => void,
  ): UnsubscribeFn;

  /**
   * Generates a token for session recovery after a crash or network switch.
   */
  getRecoveryToken(): string | null;
}
