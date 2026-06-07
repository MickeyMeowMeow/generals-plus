import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  AiHealthErrorResponseSchema,
  AiHealthOkResponseSchema,
  HealthResponseSchema,
} from "#/features/health/schemas";

export function registerHealthContracts(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/health",
    summary: "服务器健康检查",
    description: "返回服务器健康状态和运行时长。",
    tags: ["健康检查"],
    responses: {
      200: {
        description: "服务器状态正常",
        content: { "application/json": { schema: HealthResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/ai/health",
    summary: "AI 机器人服务健康检查",
    description:
      "检查 Python AI 机器人服务的健康状态。服务不可达时返回 503。",
    tags: ["健康检查"],
    responses: {
      200: {
        description: "AI 机器人服务可用",
        content: { "application/json": { schema: AiHealthOkResponseSchema } },
      },
      503: {
        description: "AI 机器人服务不可用",
        content: {
          "application/json": { schema: AiHealthErrorResponseSchema },
        },
      },
    },
  });
}
