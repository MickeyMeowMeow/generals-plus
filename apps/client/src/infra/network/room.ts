import type {
  ExtractMessageKey,
  MessagePayload,
} from "@generals-plus/shared-types";

import type { UnsubscribeFn } from "#/infra/network/types";

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
}
