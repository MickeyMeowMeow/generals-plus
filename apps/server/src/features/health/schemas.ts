import * as z from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok").describe('健康状态，健康时固定为 "ok"'),
  uptime: z.number().describe("服务器已运行秒数"),
});

export const AiHealthOkResponseSchema = z.object({
  available: z.literal(true).describe("AI 机器人服务可用"),
});

export const AiHealthErrorResponseSchema = z.object({
  available: z.literal(false).describe("AI 机器人服务不可用"),
  error: z.string().describe("错误说明"),
});
