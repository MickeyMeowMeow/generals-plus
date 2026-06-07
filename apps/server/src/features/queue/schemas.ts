import { GameMode } from "@generals-plus/engine";
import * as z from "zod";

export const QueueJoinOptionsSchema = z.object({
  gameMode: z.enum(GameMode).describe("要排队的游戏模式"),
});

export const PickColorSchema = z.object({
  color: z.number().int().describe("调色板颜色索引"),
});

export const SeatReservationSchema = z.object({
  name: z.string().describe("目标房间名称，例如 match"),
  sessionId: z.string().describe("客户端会话 ID"),
  roomId: z.string().describe("目标房间 ID"),
  reconnectionToken: z.string().optional().describe("用于重连的令牌"),
});
