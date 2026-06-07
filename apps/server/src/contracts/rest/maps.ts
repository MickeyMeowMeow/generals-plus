import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  createMapSchema,
  MapIdParamsSchema,
  MapListResponseSchema,
  MapQuerySchema,
  MapResponseSchema,
  ToggleLikeResponseSchema,
  updateMapSchema,
} from "#/features/maps/schemas";
import {
  Error400Schema,
  Error401Schema,
  Error403Schema,
  Error404Schema,
  Error500Schema,
} from "#/schemas/common";

export function registerMapsContracts(registry: OpenAPIRegistry) {
  const MapResponse = MapResponseSchema.meta({ id: "MapResponse" });

  registry.registerPath({
    method: "get",
    path: "/maps",
    summary: "List published maps",
    description:
      "Retrieve a paginated list of published custom maps with optional filtering and sorting.",
    tags: ["Maps"],
    request: {
      query: MapQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated list of maps",
        content: { "application/json": { schema: MapListResponseSchema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/maps/{id}",
    summary: "Get a single map",
    description: "Retrieve a single custom map by its unique identifier.",
    tags: ["Maps"],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      200: {
        description: "Map details",
        content: { "application/json": { schema: MapResponse } },
      },
      404: {
        description: "Map not found",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/maps",
    summary: "Create a custom map",
    description:
      "Upload and create a new custom map. Requires authentication. Subject to system settings (allowMapCreation, maxMapsPerUser).",
    tags: ["Maps"],
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: createMapSchema } } },
    },
    responses: {
      201: {
        description: "Map created successfully",
        content: { "application/json": { schema: MapResponse } },
      },
      400: {
        description: "Validation failed or invalid grid",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Authentication required",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "Map creation disabled",
        content: { "application/json": { schema: Error403Schema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });

  registry.registerPath({
    method: "put",
    path: "/maps/{id}",
    summary: "Update a map",
    description:
      "Update an existing custom map. Only the owner or an admin can update.",
    tags: ["Maps"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MapIdParamsSchema,
      body: { content: { "application/json": { schema: updateMapSchema } } },
    },
    responses: {
      200: {
        description: "Map updated successfully",
        content: { "application/json": { schema: MapResponse } },
      },
      400: {
        description: "Validation failed or invalid grid",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Authentication required",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "Map updates disabled",
        content: { "application/json": { schema: Error403Schema } },
      },
      404: {
        description: "Map not found or not authorized",
        content: { "application/json": { schema: Error404Schema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/maps/{id}",
    summary: "Delete a map",
    description: "Delete a custom map. Only the owner or an admin can delete.",
    tags: ["Maps"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      204: { description: "Map deleted successfully" },
      401: {
        description: "Authentication required",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description: "Map not found or not authorized",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/maps/{id}/like",
    summary: "Toggle like on a map",
    description:
      "Toggle the authenticated user's like on a map. Returns 'liked' or 'unliked'.",
    tags: ["Maps"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      200: {
        description: "Like toggled successfully",
        content: { "application/json": { schema: ToggleLikeResponseSchema } },
      },
      401: {
        description: "Authentication required",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description: "Map not found",
        content: { "application/json": { schema: Error404Schema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });
}
