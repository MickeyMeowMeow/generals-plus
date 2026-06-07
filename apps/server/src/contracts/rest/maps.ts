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
    summary: "获取已发布地图列表",
    description:
      "分页获取已发布的自定义地图，支持按条件筛选和排序。",
    tags: ["地图"],
    request: {
      query: MapQuerySchema,
    },
    responses: {
      200: {
        description: "分页地图列表",
        content: { "application/json": { schema: MapListResponseSchema } },
      },
      500: {
        description: "服务器内部错误",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/maps/{id}",
    summary: "获取单个地图",
    description: "根据唯一标识获取单个自定义地图。",
    tags: ["地图"],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      200: {
        description: "地图详情",
        content: { "application/json": { schema: MapResponse } },
      },
      404: {
        description: "未找到地图",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/maps",
    summary: "创建自定义地图",
    description:
      "上传并创建新的自定义地图。需要认证，并受系统设置 allowMapCreation 与 maxMapsPerUser 限制。",
    tags: ["地图"],
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: createMapSchema } } },
    },
    responses: {
      201: {
        description: "地图创建成功",
        content: { "application/json": { schema: MapResponse } },
      },
      400: {
        description: "校验失败或地图网格无效",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "需要认证",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "地图创建功能已禁用",
        content: { "application/json": { schema: Error403Schema } },
      },
      500: {
        description: "服务器内部错误",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });

  registry.registerPath({
    method: "put",
    path: "/maps/{id}",
    summary: "更新地图",
    description:
      "更新已有自定义地图。仅地图作者或管理员可执行。",
    tags: ["地图"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MapIdParamsSchema,
      body: { content: { "application/json": { schema: updateMapSchema } } },
    },
    responses: {
      200: {
        description: "地图更新成功",
        content: { "application/json": { schema: MapResponse } },
      },
      400: {
        description: "校验失败或地图网格无效",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "需要认证",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "地图更新功能已禁用",
        content: { "application/json": { schema: Error403Schema } },
      },
      404: {
        description: "未找到地图，或当前用户无权操作",
        content: { "application/json": { schema: Error404Schema } },
      },
      500: {
        description: "服务器内部错误",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/maps/{id}",
    summary: "删除地图",
    description: "删除自定义地图。仅地图作者或管理员可执行。",
    tags: ["地图"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      204: { description: "地图删除成功" },
      401: {
        description: "需要认证",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description: "未找到地图，或当前用户无权操作",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/maps/{id}/like",
    summary: "切换地图点赞状态",
    description:
      "切换当前认证用户对地图的点赞状态，返回 liked 或 unliked。",
    tags: ["地图"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MapIdParamsSchema,
    },
    responses: {
      200: {
        description: "点赞状态切换成功",
        content: { "application/json": { schema: ToggleLikeResponseSchema } },
      },
      401: {
        description: "需要认证",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description: "未找到地图",
        content: { "application/json": { schema: Error404Schema } },
      },
      500: {
        description: "服务器内部错误",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });
}
