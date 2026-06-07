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
      "Return published custom maps with pagination, filtering, and sorting.",
    tags: ["maps"],
    request: {
      query: MapQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated map list",
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
    description: "Return a custom map by its unique identifier.",
    tags: ["maps"],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      200: {
        description: "Map details",
        content: { "application/json": { schema: MapResponse } },
      },
      404: {
        description: "Map was not found",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/maps",
    summary: "Create a custom map",
    description:
      "Upload and create a new custom map. Authentication is required and the request is subject to allowMapCreation and maxMapsPerUser system settings.",
    tags: ["maps"],
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
        description: "Validation failed or the map grid is invalid",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Authentication is required",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "Map creation is disabled",
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
      "Update an existing custom map. Only the map author or an administrator can perform this action.",
    tags: ["maps"],
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
        description: "Validation failed or the map grid is invalid",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Authentication is required",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "Map updates are disabled",
        content: { "application/json": { schema: Error403Schema } },
      },
      404: {
        description:
          "Map was not found or the current user does not have access",
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
    description:
      "Delete a custom map. Only the map author or an administrator can perform this action.",
    tags: ["maps"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      204: { description: "Map deleted successfully" },
      401: {
        description: "Authentication is required",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description:
          "Map was not found or the current user does not have access",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/maps/{id}/like",
    summary: "Toggle map like state",
    description:
      "Toggle the current authenticated user's like state for the map and return liked or unliked.",
    tags: ["maps"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      200: {
        description: "Like state toggled successfully",
        content: { "application/json": { schema: ToggleLikeResponseSchema } },
      },
      401: {
        description: "Authentication is required",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description: "Map was not found",
        content: { "application/json": { schema: Error404Schema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });
}
