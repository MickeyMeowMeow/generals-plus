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
      "Returns public settings for non-authenticated users. Authenticated admins receive the full settings object.",
    tags: ["System"],
    responses: {
      200: {
        description: "Public settings (non-admin) or full settings (admin)",
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
    summary: "Stream system settings via SSE",
    description:
      "Server-Sent Events endpoint that sends the current settings on connect and pushes updates in real-time.",
    tags: ["System"],
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
    description: "Update system settings. Requires admin authentication.",
    tags: ["System"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: UpdateSystemSettingsSchema } },
      },
    },
    responses: {
      200: {
        description: "Settings updated successfully",
        content: { "application/json": { schema: FullSettings } },
      },
      401: {
        description: "Authentication required",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "Admin access required",
        content: { "application/json": { schema: Error403Schema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });
}
