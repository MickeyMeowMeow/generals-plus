import { ActionType, GameMode } from "@generals-plus/engine";
import * as z from "zod";

export const CoordinateSchema = z.object({
  x: z.number().int().describe("X coordinate on the grid"),
  y: z.number().int().describe("Y coordinate on the grid"),
});

export const MoveActionSchema = z.object({
  type: z
    .enum([ActionType.MOVE, ActionType.SPLIT_MOVE])
    .describe("Action type: move or split_move"),
  from: CoordinateSchema.describe("Origin coordinate"),
  to: CoordinateSchema.describe("Destination coordinate"),
});

export const SurrenderActionSchema = z.object({
  type: z
    .literal(ActionType.SURRENDER)
    .describe("Surrender and end the current match"),
});

export const ActionSchema = z.discriminatedUnion("type", [
  MoveActionSchema,
  SurrenderActionSchema,
]);

export const ClientPingSchema = z.object({
  x: z.number().int().describe("Ping X coordinate"),
  y: z.number().int().describe("Ping Y coordinate"),
  type: z.enum(["attack", "defense", "rally"]).describe("Ping type"),
});

export const ServerPingSchema = z.object({
  playerId: z.string().describe("ID of the player who sent the ping"),
  x: z.number().int().describe("Ping X coordinate"),
  y: z.number().int().describe("Ping Y coordinate"),
  type: z.string().describe("Ping type"),
});

export const GameResultSchema = z.object({
  mode: z.enum(GameMode).describe("Game mode"),
  winnerTeamId: z
    .string()
    .nullable()
    .describe("Winning team ID, or null for a draw"),
});
