import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import * as z from "zod";

import {
  AnonymousSignInSchema,
  AuthSuccessResponseSchema,
  AuthUserDataResponseSchema,
  ColyseusAdminLoginSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
} from "#/features/auth/schemas";
import {
  Error400Schema,
  Error401Schema,
  Error403Schema,
} from "#/schemas/common";

export function registerAuthContracts(registry: OpenAPIRegistry) {
  const AuthSuccess = AuthSuccessResponseSchema.meta({
    id: "AuthSuccessResponse",
  });
  const AuthUserData = AuthUserDataResponseSchema.meta({
    id: "AuthUserDataResponse",
  });

  registry.registerPath({
    method: "get",
    path: "/auth/userdata",
    summary: "获取当前认证用户信息",
    description: "解析当前 Bearer 令牌并返回认证用户数据。",
    tags: ["认证"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "认证用户数据",
        content: { "application/json": { schema: AuthUserData } },
      },
      401: {
        description: "令牌无效或缺失",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/register",
    summary: "使用邮箱和密码注册",
    description:
      "使用邮箱和密码创建新账号。options 中的特权字段会在服务端被移除。",
    tags: ["认证"],
    request: {
      body: { content: { "application/json": { schema: RegisterSchema } } },
    },
    responses: {
      200: {
        description: "注册成功，返回用户信息和 JWT",
        content: { "application/json": { schema: AuthSuccess } },
      },
      400: {
        description: "邮箱或密码格式不正确",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "注册失败，例如邮箱已存在",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/login",
    summary: "使用邮箱和密码登录",
    description: "使用邮箱和密码进行认证，并返回 JWT 令牌。",
    tags: ["认证"],
    request: {
      body: { content: { "application/json": { schema: LoginSchema } } },
    },
    responses: {
      200: {
        description: "登录成功，返回用户信息和 JWT",
        content: { "application/json": { schema: AuthSuccess } },
      },
      401: {
        description: "凭证无效",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/anonymous",
    summary: "匿名登录",
    description: "创建匿名账号。请求体中可选传入初始化 options。",
    tags: ["认证"],
    request: {
      body: {
        content: { "application/json": { schema: AnonymousSignInSchema } },
      },
    },
    responses: {
      200: {
        description: "匿名登录成功，返回用户信息和 JWT",
        content: { "application/json": { schema: AuthSuccess } },
      },
      401: {
        description: "匿名登录失败",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/forgot-password",
    summary: "请求发送密码重置邮件",
    description:
      "触发找回密码流程。当前运行环境是否接受该请求取决于鉴权回调配置。",
    tags: ["认证"],
    request: {
      body: {
        content: { "application/json": { schema: ForgotPasswordSchema } },
      },
    },
    responses: {
      200: {
        description: "找回密码处理器已接受请求",
        content: {
          "application/json": {
            schema: z.union([z.boolean(), z.record(z.string(), z.unknown())]),
          },
        },
      },
      401: {
        description: "找回密码流程不可用，或请求被拒绝",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/colyseus/login",
    summary: "登录 Colyseus 管理面板",
    description:
      "使用 JWT 令牌换取访问 Colyseus Monitor 所需的 httpOnly Cookie。出错时返回 HTML，成功时返回 302 重定向。",
    tags: ["认证"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: ColyseusAdminLoginSchema } },
      },
    },
    responses: {
      302: { description: "设置认证 Cookie 后重定向到 /colyseus/" },
      401: {
        description: "令牌无效",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "不是管理员",
        content: { "application/json": { schema: Error403Schema } },
      },
    },
  });
}
