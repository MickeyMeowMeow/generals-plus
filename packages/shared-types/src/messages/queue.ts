import type { MessagePayload } from "#/messages";
import type { SeatReservation } from "#/seat";

export const QueueClientMessage = {
  CONFIRM: "confirm",
  PICK_COLOR: "pickColor",
} as const;

export type QueueClientMessage =
  (typeof QueueClientMessage)[keyof typeof QueueClientMessage];

export interface QueueClientMessagePayload extends MessagePayload {
  [QueueClientMessage.CONFIRM]: never;
  [QueueClientMessage.PICK_COLOR]: {
    color: number;
  };
}

export const QueueServerMessage = {
  ERROR: "error",
  SEAT_RESERVATION: "seat",
} as const;

export type QueueServerMessage =
  (typeof QueueServerMessage)[keyof typeof QueueServerMessage];

export interface QueueServerMessagePayload extends MessagePayload {
  [QueueServerMessage.ERROR]: string;
  [QueueServerMessage.SEAT_RESERVATION]: SeatReservation;
}
