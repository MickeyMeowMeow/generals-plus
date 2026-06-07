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
    summary: "Update the current user profile",
    description:
      "Update the current authenticated user's display name and preferences. The preferences field must contain the complete object when provided.",
    tags: ["profile"],
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
        description: "Request validation failed",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Authentication is required",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description: "User was not found",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });
}
