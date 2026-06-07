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
    .describe("Game mode used to list and join the setup room"),
});

const SetupRoomCreationOptionsSchema = z.object({
  gameMode: z
    .enum(GameMode)
    .default(GameMode.CLASSIC)
    .describe("Initial game mode for the created setup room"),
  isPublic: z
    .boolean()
    .default(true)
    .describe("Whether the room is visible in public listings"),
  maxPlayers: z
    .number()
    .int()
    .min(2)
    .optional()
    .describe("Optional max player override for the room"),
  customRoomKey: z
    .string()
    .optional()
    .describe("Custom-room key seeded by the server for private setup rooms"),
});

const SetupValidationFailedSchema = z.object({
  message: z.string().describe("Human-readable validation error message"),
  severity: ToastSeveritySchema.describe("Toast severity level"),
  field: z.string().optional().describe("The field that failed validation"),
});

export const setupWsContracts = {
  channel: "setup",
  description:
    "Pre-game lobby for configuring a custom match before creating the authoritative match room.",
  joinOptions: SetupJoinOptionsSchema,
  roomCreationOptions: SetupRoomCreationOptionsSchema,
  clientToServer: {
    pickColor: {
      summary: "Pick a palette color",
      payload: PickColorSchema,
    },
    pickTeam: {
      summary: "Pick an existing team or request a new team",
      payload: z.object({
        teamId: z.string().optional().describe("Existing team ID to join"),
        createNew: z.boolean().optional().describe("Request a new team"),
      }),
    },
    updateSettings: {
      summary: "Host-only: update game configuration settings",
      payload: setupSettingsUpdateSchema,
    },
    start: {
      summary: "Host-only: start the game",
      payload: z.object({}).describe("No payload"),
    },
  },
  serverToClient: {
    error: {
      summary: "Setup error message",
      payload: z.string().describe("Human-readable error message"),
    },
    validationFailed: {
      summary: "Settings or start-game validation failure",
      payload: SetupValidationFailedSchema,
    },
    seat: {
      summary: "Game started and a seat reservation was issued",
      payload: SeatReservationSchema,
    },
  },
};
