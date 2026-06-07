import { GameMode } from "@generals-plus/engine";
import * as z from "zod";

import {
  PickColorSchema,
  SeatReservationSchema,
} from "#/features/queue/schemas";
import { setupSettingsUpdateSchema } from "#/features/setup/schemas";

const ToastSeveritySchema = z.enum(["info", "warning", "error", "success"]);

const SetupJoinOptionsSchema = z.object({
  gameMode: z
    .enum(GameMode)
    .describe("Game mode used to list and join setup rooms"),
});

const SetupRoomCreationOptionsSchema = z.object({
  gameMode: z
    .enum(GameMode)
    .default(GameMode.CLASSIC)
    .describe("Initial game mode used when creating a setup room"),
  isPublic: z
    .boolean()
    .default(true)
    .describe("Whether the room appears in the public room list"),
  maxPlayers: z
    .number()
    .int()
    .min(2)
    .optional()
    .describe("Optional maximum player count override for the room"),
  customRoomKey: z
    .string()
    .optional()
    .describe(
      "Custom room key pre-assigned by the server for a private setup room",
    ),
});

const SetupValidationFailedSchema = z.object({
  message: z.string().describe("User-facing validation error message"),
  severity: ToastSeveritySchema.describe("Toast severity level"),
  field: z.string().optional().describe("Field that failed validation"),
});

export const setupWsContracts = {
  channel: "setup",
  description:
    "Pre-game setup lobby used to configure a custom match before the actual room is created.",
  joinOptions: SetupJoinOptionsSchema,
  roomCreationOptions: SetupRoomCreationOptionsSchema,
  clientToServer: {
    pickColor: {
      summary: "Choose a color",
      payload: PickColorSchema,
    },
    pickTeam: {
      summary: "Join an existing team or request a new one",
      payload: z.object({
        teamId: z
          .string()
          .optional()
          .describe("Identifier of the existing team to join"),
        createNew: z
          .boolean()
          .optional()
          .describe("Whether to request creation of a new team"),
      }),
    },
    updateSettings: {
      summary: "Host only: update match settings",
      payload: setupSettingsUpdateSchema,
    },
    start: {
      summary: "Host only: start the game",
      payload: z.object({}).describe("Empty request body"),
    },
  },
  serverToClient: {
    error: {
      summary: "Room error message",
      payload: z.string().describe("User-facing error message"),
    },
    validationFailed: {
      summary: "Settings update or game start validation failed",
      payload: SetupValidationFailedSchema,
    },
    seat: {
      summary: "Game started and seat reservation details were issued",
      payload: SeatReservationSchema,
    },
  },
};
