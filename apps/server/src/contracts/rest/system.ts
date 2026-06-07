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
    summary: "获取系统设置",
    description: "未认证用户获取公开设置；已认证管理员可获取完整设置对象。",
    tags: ["系统设置"],
    responses: {
      200: {
        description: "公开设置（普通用户）或完整设置（管理员）",
        content: {
          "application/json": {
            schema: z.union([PublicSettings, FullSettings]),
          },
        },
      },
      500: {
        description: "服务器内部错误",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/system/settings/stream",
    summary: "通过 SSE 实时推送系统设置",
    description:
      "Server-Sent Events 接口。连接建立时会先发送当前设置，后续实时推送更新。",
    tags: ["系统设置"],
    responses: {
      200: {
        description: "系统设置更新的 SSE 数据流",
        content: { "text/event-stream": { schema: FullSettings } },
      },
    },
  });

  registry.registerPath({
    method: "put",
    path: "/system/settings",
    summary: "更新系统设置",
    description: "更新系统设置。需要管理员认证。",
    tags: ["系统设置"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: UpdateSystemSettingsSchema } },
      },
    },
    responses: {
      200: {
        description: "系统设置更新成功",
        content: { "application/json": { schema: FullSettings } },
      },
      401: {
        description: "需要认证",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "需要管理员权限",
        content: { "application/json": { schema: Error403Schema } },
      },
      500: {
        description: "服务器内部错误",
        content: { "application/json": { schema: Error500Schema } },
      },
    },
  });
}
