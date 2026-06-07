import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  CreateCustomRoomSchema,
  CustomRoomResolutionSchema,
  ResolveCustomRoomParamsSchema,
} from "#/features/setup/custom-room-schemas";
import {
  Error400Schema,
  Error401Schema,
  Error409Schema,
} from "#/schemas/common";

export function registerCustomRoomContracts(registry: OpenAPIRegistry) {
  const Resolution = CustomRoomResolutionSchema.meta({
    id: "CustomRoomResolution",
  });

  registry.registerPath({
    method: "post",
    path: "/custom-rooms",
    summary: "Create a custom room",
    description:
      "Create a new custom room with an optional key. If no key is provided, one is auto-generated.",
    tags: ["Custom Rooms"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: CreateCustomRoomSchema } },
      },
    },
    responses: {
      201: {
        description: "Custom room created",
        content: { "application/json": { schema: Resolution } },
      },
      400: {
        description: "Invalid custom room key",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Authentication required",
        content: { "application/json": { schema: Error401Schema } },
      },
      409: {
        description: "Room already exists",
        content: { "application/json": { schema: Error409Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/custom-rooms/{customRoomKey}/resolve",
    summary: "Resolve a custom room",
    description:
      "Resolve a custom room key and either join the existing setup room or create it on demand.",
    tags: ["Custom Rooms"],
    security: [{ bearerAuth: [] }],
    request: {
      params: ResolveCustomRoomParamsSchema,
    },
    responses: {
      200: {
        description: "Room resolved (joined or created)",
        content: { "application/json": { schema: Resolution } },
      },
      400: {
        description: "Invalid custom room key",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Authentication required",
        content: { "application/json": { schema: Error401Schema } },
      },
      409: {
        description: "Room is full",
        content: { "application/json": { schema: Error409Schema } },
      },
    },
  });
}
