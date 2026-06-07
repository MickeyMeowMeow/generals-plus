import * as z from "zod";

export const AuthUserSchema = z.object({
  id: z.string().describe("用户唯一标识"),
  email: z.string().optional().describe("用户邮箱地址"),
  displayName: z.string().optional().describe("显示名称"),
  anonymous: z
    .boolean()
    .optional()
    .describe("账号是否为匿名账号"),
  verified: z.boolean().optional().describe("邮箱是否已验证"),
  ratings: z
    .record(z.string(), z.number())
    .optional()
    .describe("按游戏模式区分的评分"),
  preferences: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("用户偏好设置对象"),
  isAdmin: z.boolean().optional().describe("用户是否为管理员"),
});

export const RegisterSchema = z.object({
  email: z.string().email().describe("用户邮箱地址"),
  password: z.string().min(1).describe("用户密码"),
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("附加注册选项，服务端会做清洗"),
});

export const LoginSchema = z.object({
  email: z.string().email().describe("用户邮箱地址"),
  password: z.string().min(1).describe("用户密码"),
});

export const AnonymousSignInSchema = z.object({
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("可选的匿名用户初始化数据"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().describe("用户邮箱地址"),
});

export const ColyseusAdminLoginSchema = z.object({
  token: z.string().describe("JWT 认证令牌"),
  basePath: z.string().optional().describe("Cookie 生效的基础路径"),
});

export const AuthSuccessResponseSchema = z.object({
  token: z.string().describe("JWT 认证令牌"),
  user: AuthUserSchema.describe("认证用户数据"),
});

export const AuthUserDataResponseSchema = z.object({
  user: AuthUserSchema.describe("认证用户数据"),
});
