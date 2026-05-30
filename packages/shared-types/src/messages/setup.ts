import type { MessagePayload } from "#/messages";
import type { ToastMessage } from "#/messages/common";
import type { SeatReservation } from "#/seat";
import type { SetupSettings } from "#/setup-settings";

export type SetupValidationField =
  | keyof SetupSettings
  | "color"
  | "team"
  | "players"
  | "flagCount"
  | "targetScore"
  | "bombSiteCount"
  | "plantDuration"
  | "defuseDuration"
  | "detonateDuration"
  | "collapseInterval"
  | "startDelay"
  | "collapseShape"
  | "payloadSpeed"
  | "payloadCartSize"
  | "payloadRequiredOccupied";

export interface SetupValidationFailedMessage extends ToastMessage {
  field?: SetupValidationField;
}

export const SetupClientMessage = {
  PICK_COLOR: "pickColor",
  PICK_TEAM: "pickTeam",
  UPDATE_SETTINGS: "updateSettings",
  START_GAME: "start",
} as const;

export type SetupClientMessage =
  (typeof SetupClientMessage)[keyof typeof SetupClientMessage];

export interface SetupClientMessagePayload extends MessagePayload {
  [SetupClientMessage.PICK_COLOR]: {
    color: number;
  };
  [SetupClientMessage.PICK_TEAM]: {
    teamId?: string;
    createNew?: boolean;
  };
  [SetupClientMessage.UPDATE_SETTINGS]: Partial<SetupSettings>;
  [SetupClientMessage.START_GAME]: never;
}

export const SetupServerMessage = {
  ERROR: "error",
  VALIDATION_FAILED: "validationFailed",
  SEAT_RESERVATION: "seat",
} as const;

export type SetupServerMessage =
  (typeof SetupServerMessage)[keyof typeof SetupServerMessage];

export interface SetupServerMessagePayload extends MessagePayload {
  [SetupServerMessage.ERROR]: string;
  [SetupServerMessage.VALIDATION_FAILED]: SetupValidationFailedMessage;
  [SetupServerMessage.SEAT_RESERVATION]: SeatReservation;
}
