import type {
  ExtractMessageKey,
  MessagePayload,
} from "@generals-plus/shared-types";

import type { UnsubscribeFn } from "#/infra/network/types";

export const RoomStatus = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
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

  send<K extends ExtractMessageKey<Sent>>(type: K, message?: Sent[K]): void;

  leave(consented?: boolean): Promise<void>;

  onStateChange(callback: (state: State) => void): UnsubscribeFn;

  onMessage<K extends ExtractMessageKey<Received>>(
    type: K,
    callback: (payload: Received[K]) => void,
  ): UnsubscribeFn;

  onStatusChange(
    callback: (status: RoomStatus, details?: string) => void,
  ): UnsubscribeFn;

  onError(callback: (code: number, message?: string) => void): UnsubscribeFn;

  onLeave(callback: (code: number, reason?: string) => void): UnsubscribeFn;
}
