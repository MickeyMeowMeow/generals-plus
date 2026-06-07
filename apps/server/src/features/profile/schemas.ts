import * as z from "zod";

const BackgroundPresetIdSchema = z.enum(["default", "touhou"]);

export const BackgroundImageSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("preset").describe("使用内置背景预设"),
    presetId: BackgroundPresetIdSchema.describe("预设标识"),
  }),
  z.object({
    source: z.literal("customUrl").describe("使用自定义背景图片 URL"),
    customUrl: z.string().describe("背景图片的 HTTP 或 HTTPS URL"),
  }),
]);

export const AvatarSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("default").describe("使用默认首字母头像"),
  }),
  z.object({
    source: z.literal("customUrl").describe("使用自定义头像图片 URL"),
    customUrl: z.string().describe("头像图片的 HTTP 或 HTTPS URL"),
  }),
]);

export const MotionSchema = z.object({
  mode: z
    .enum(["system", "full", "reduced"])
    .describe("动效偏好：system 跟随系统，full 全开，reduced 最小化"),
});

export const StageAppearanceSchema = z.object({
  backdropBlur: z.boolean().default(true).describe("是否启用背景模糊效果"),
  backdropOpacity: z
    .number()
    .min(0)
    .max(100)
    .default(58)
    .describe("背景遮罩透明度，范围 0 到 100"),
});

export const UserPreferencesSchema = z.object({
  backgroundImage: BackgroundImageSchema.describe("背景图片偏好"),
  avatar: AvatarSchema.describe("头像偏好"),
  motion: MotionSchema.describe("动效偏好"),
  stageAppearance: StageAppearanceSchema.describe("舞台背景视觉控制"),
});

export const UpdateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(32)
    .describe("显示名称，去除首尾空格后长度为 1 到 32")
    .optional(),
  preferences: UserPreferencesSchema.describe(
    "完整的用户偏好设置对象",
  ).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const PublicUserSchema = z.object({
  id: z.string().describe("用户唯一标识"),
  email: z.string().optional().describe("用户邮箱地址"),
  displayName: z.string().optional().describe("显示名称"),
  anonymous: z.boolean().optional().describe("账号是否为匿名账号"),
  verified: z.boolean().optional().describe("邮箱是否已验证"),
  ratings: z
    .record(z.string(), z.number())
    .optional()
    .describe("按游戏模式区分的 ELO 评分"),
  preferences: UserPreferencesSchema.optional().describe("用户偏好设置"),
  isAdmin: z.boolean().optional().describe("用户是否为管理员"),
});
