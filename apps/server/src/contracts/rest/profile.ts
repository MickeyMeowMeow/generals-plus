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
    summary: "更新用户资料",
    description:
      "更新当前认证用户的显示名称和偏好设置。提交 preferences 时必须传完整对象。",
    tags: ["用户资料"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: UpdateProfileSchema } },
      },
    },
    responses: {
      200: {
        description: "用户资料更新成功",
        content: { "application/json": { schema: PublicUser } },
      },
      400: {
        description: "请求参数校验失败",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "需要认证",
        content: { "application/json": { schema: Error401Schema } },
      },
      404: {
        description: "未找到用户",
        content: { "application/json": { schema: Error404Schema } },
      },
    },
  });
}
