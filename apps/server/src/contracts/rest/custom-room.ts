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
    summary: "创建自定义房间",
    description:
      "创建新的自定义房间。可选传入房间密钥；未传时自动生成。",
    tags: ["自定义房间"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: CreateCustomRoomSchema } },
      },
    },
    responses: {
      201: {
        description: "自定义房间创建成功",
        content: { "application/json": { schema: Resolution } },
      },
      400: {
        description: "自定义房间密钥无效",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "需要认证",
        content: { "application/json": { schema: Error401Schema } },
      },
      409: {
        description: "房间已存在",
        content: { "application/json": { schema: Error409Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/custom-rooms/{customRoomKey}/resolve",
    summary: "解析自定义房间",
    description:
      "根据自定义房间密钥解析目标房间，并加入已有 setup 房间或按需创建新房间。",
    tags: ["自定义房间"],
    security: [{ bearerAuth: [] }],
    request: {
      params: ResolveCustomRoomParamsSchema,
    },
    responses: {
      200: {
        description: "房间解析成功，已加入或已创建",
        content: { "application/json": { schema: Resolution } },
      },
      400: {
        description: "自定义房间密钥无效",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "需要认证",
        content: { "application/json": { schema: Error401Schema } },
      },
      409: {
        description: "房间已满",
        content: { "application/json": { schema: Error409Schema } },
      },
    },
  });
}
