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
  from: CoordinateSchema.describe("Source coordinate"),
  to: CoordinateSchema.describe("Target coordinate"),
});

export const SurrenderActionSchema = z.object({
  type: z.literal(ActionType.SURRENDER).describe("Surrender the match"),
});

export const ActionSchema = z.discriminatedUnion("type", [
  MoveActionSchema,
  SurrenderActionSchema,
]);

export const ClientPingSchema = z.object({
  x: z.number().int().describe("X coordinate of the ping"),
  y: z.number().int().describe("Y coordinate of the ping"),
  type: z.enum(["attack", "defense", "rally"]).describe("Ping type category"),
});

export const ServerPingSchema = z.object({
  playerId: z.string().describe("ID of the player who sent the ping"),
  x: z.number().int().describe("X coordinate of the ping"),
  y: z.number().int().describe("Y coordinate of the ping"),
  type: z.string().describe("Ping type"),
});

export const GameResultSchema = z.object({
  mode: z.enum(GameMode).describe("Game mode"),
  winnerTeamId: z.string().nullable().describe("Winning team ID, null if draw"),
});
