import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import * as z from "zod";

import {
  PublicSystemSettingsSchema,
  SystemSettingsSchema,
  UpdateSystemSettingsSchema,
} from "#/features/system/schemas";
import {
  Error401Schema,
  Error403Schema,
  Error500Schema,
} from "#/schemas/common";

export function registerSystemContracts(registry: OpenAPIRegistry) {
  const FullSettings = SystemSettingsSchema.meta({ id: "SystemSettings" });
  const PublicSettings = PublicSystemSettingsSchema.meta({
    id: "PublicSystemSettings",
  });

  registry.registerPath({
    method: "get",
    path: "/system/settings",
    summary: "Get system settings",
    description:
      "Return public settings for anonymous users and the full settings object for authenticated administrators.",
    tags: ["systemSettings"],
    responses: {
      200: {
        description:
          "Public settings for regular users or the full settings object for administrators",
        content: {
          "application/json": {
            schema: z.union([PublicSettings, FullSettings]),
          },
        },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/system/settings/stream",
    summary: "Stream system settings over SSE",
    description:
      "Server-Sent Events endpoint. The current settings are sent when the connection is established and later updates are streamed in real time.",
    tags: ["systemSettings"],
    responses: {
      200: {
        description: "SSE stream of system settings updates",
        content: { "text/event-stream": { schema: FullSettings } },
      },
    },
  });

  registry.registerPath({
    method: "put",
    path: "/system/settings",
    summary: "Update system settings",
    description:
      "Update system settings. Administrator authentication is required.",
    tags: ["systemSettings"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: UpdateSystemSettingsSchema } },
      },
    },
    responses: {
      200: {
        description: "System settings updated successfully",
        content: { "application/json": { schema: FullSettings } },
      },
      401: {
        description: "Authentication is required",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "Administrator privileges are required",
        content: { "application/json": { schema: Error403Schema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });
}
