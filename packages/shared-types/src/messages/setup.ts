import type { GameMode } from "@generals-plus/engine";

import type { MessagePayload } from "#/messages";
import type { SeatReservation } from "#/seat";
import type { SetupSettings } from "#/setup-settings";

export const SetupClientMessage = {
  PICK_COLOR: "pickColor",
  UPDATE_SETTINGS: "updateSettings",
  START_GAME: "start",
} as const;

export type SetupClientMessage =
  (typeof SetupClientMessage)[keyof typeof SetupClientMessage];

export interface SetupClientMessagePayload extends MessagePayload {
  [SetupClientMessage.PICK_COLOR]: {
    color: number;
  };
  [SetupClientMessage.UPDATE_SETTINGS]: Partial<SetupSettings>;
  [SetupClientMessage.START_GAME]: never;
}

export const SetupServerMessage = {
  ERROR: "error",
  SEAT_RESERVATION: "seat",
} as const;

export type SetupServerMessage =
  (typeof SetupServerMessage)[keyof typeof SetupServerMessage];

export interface SetupServerMessagePayload extends MessagePayload {
  [SetupServerMessage.ERROR]: string;
  [SetupServerMessage.SEAT_RESERVATION]: SeatReservation;
}
