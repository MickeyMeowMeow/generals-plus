import * as z from "zod";

export const HealthResponseSchema = z.object({
  status: z
    .literal("ok")
    .describe('Health status. Always "ok" when the service is healthy'),
  uptime: z.number().describe("Server uptime in seconds"),
});

export const AiHealthOkResponseSchema = z.object({
  available: z.literal(true).describe("AI bot service is available"),
});

export const AiHealthErrorResponseSchema = z.object({
  available: z.literal(false).describe("AI bot service is unavailable"),
  error: z.string().describe("Error details"),
});
