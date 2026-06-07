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
    summary: "Check server health",
    description: "Return the current server health status and uptime.",
    tags: ["health"],
    responses: {
      200: {
        description: "Server is healthy",
        content: { "application/json": { schema: HealthResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/ai/health",
    summary: "Check AI service health",
    description:
      "Check the health of the Python AI bot service. Returns 503 when the service is unreachable.",
    tags: ["health"],
    responses: {
      200: {
        description: "AI bot service is available",
        content: { "application/json": { schema: AiHealthOkResponseSchema } },
      },
      503: {
        description: "AI bot service is unavailable",
        content: {
          "application/json": { schema: AiHealthErrorResponseSchema },
        },
      },
    },
  });
}
