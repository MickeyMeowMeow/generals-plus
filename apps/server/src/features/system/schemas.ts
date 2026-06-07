import * as z from "zod";

export const SystemSettingsSchema = z.object({
  allowMapCreation: z
    .boolean()
    .describe("是否允许非管理员创建地图"),
  allowMapUpdates: z
    .boolean()
    .describe("是否允许非管理员更新地图"),
  systemBanner: z
    .string()
    .describe("面向所有用户展示的系统横幅消息"),
  maxMapsPerUser: z.number().int().describe("每位用户可拥有的最大地图数"),
  maxTotalRooms: z
    .number()
    .int()
    .describe("最大同时存在的游戏房间总数，仅管理员可见"),
  maxVsAiRooms: z
    .number()
    .int()
    .describe("最大同时存在的人机对战房间数，仅管理员可见"),
  maintenanceMode: z
    .boolean()
    .describe("系统是否处于维护模式"),
});

export const PublicSystemSettingsSchema = z.object({
  allowMapCreation: z
    .boolean()
    .describe("是否允许非管理员创建地图"),
  allowMapUpdates: z
    .boolean()
    .describe("是否允许非管理员更新地图"),
  systemBanner: z.string().describe("系统横幅消息"),
  maxMapsPerUser: z.number().int().describe("每位用户可拥有的最大地图数"),
  maintenanceMode: z.boolean().describe("维护模式状态"),
});

export const UpdateSystemSettingsSchema = SystemSettingsSchema.partial();

export type UpdateSystemSettingsInput = z.infer<
  typeof UpdateSystemSettingsSchema
>;
