import { GameMode } from "@generals-plus/engine";
import * as z from "zod";

export const QueueJoinOptionsSchema = z.object({
  gameMode: z.enum(GameMode).describe("Game mode to queue for"),
});

export const PickColorSchema = z.object({
  color: z.number().int().describe("Palette color index"),
});

export const SeatReservationSchema = z.object({
  name: z.string().describe("Target room name, for example match"),
  sessionId: z.string().describe("Client session ID"),
  roomId: z.string().describe("Target room ID"),
  reconnectionToken: z
    .string()
    .optional()
    .describe("Token used for reconnection"),
});
