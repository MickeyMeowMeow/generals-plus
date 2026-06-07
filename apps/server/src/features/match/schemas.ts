import { ActionType, GameMode } from "@generals-plus/engine";
import * as z from "zod";

export const CoordinateSchema = z.object({
  x: z.number().int().describe("网格上的 X 坐标"),
  y: z.number().int().describe("网格上的 Y 坐标"),
});

export const MoveActionSchema = z.object({
  type: z
    .enum([ActionType.MOVE, ActionType.SPLIT_MOVE])
    .describe("操作类型：move 或 split_move"),
  from: CoordinateSchema.describe("起始坐标"),
  to: CoordinateSchema.describe("目标坐标"),
});

export const SurrenderActionSchema = z.object({
  type: z.literal(ActionType.SURRENDER).describe("投降并结束本场对局"),
});

export const ActionSchema = z.discriminatedUnion("type", [
  MoveActionSchema,
  SurrenderActionSchema,
]);

export const ClientPingSchema = z.object({
  x: z.number().int().describe("标记的 X 坐标"),
  y: z.number().int().describe("标记的 Y 坐标"),
  type: z.enum(["attack", "defense", "rally"]).describe("标记类型"),
});

export const ServerPingSchema = z.object({
  playerId: z.string().describe("发送标记的玩家 ID"),
  x: z.number().int().describe("标记的 X 坐标"),
  y: z.number().int().describe("标记的 Y 坐标"),
  type: z.string().describe("标记类型"),
});

export const GameResultSchema = z.object({
  mode: z.enum(GameMode).describe("游戏模式"),
  winnerTeamId: z.string().nullable().describe("获胜队伍 ID；平局时为 null"),
});
