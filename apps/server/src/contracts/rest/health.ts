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
    summary: "Server health check",
    description: "Returns the server health status and uptime.",
    tags: ["Health"],
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
    summary: "AI bot service health check",
    description:
      "Checks the health of the Python AI bot service. Returns 503 if the bot service is unreachable.",
    tags: ["Health"],
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
