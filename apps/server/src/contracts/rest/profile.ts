import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  PublicUserSchema,
  UpdateProfileSchema,
} from "#/features/profile/schemas";
import {
  Error400Schema,
  Error401Schema,
  Error404Schema,
} from "#/schemas/common";

export function registerProfileContracts(registry: OpenAPIRegistry) {
  const PublicUser = PublicUserSchema.meta({ id: "PublicUser" });

  registry.registerPath({
    method: "patch",
    path: "/profile",
    summary: "Update user profile",
    description:
      "Update the authenticated user's display name and/or preferences. The preferences payload must be complete when provided.",
    tags: ["Profile"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: UpdateProfileSchema } },
      },
    },
    responses: {
      200: {
        description: "Profile updated successfully",
        content: { "application/json": { schema: PublicUser } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Authentication required",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description: "User not found",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });
}
