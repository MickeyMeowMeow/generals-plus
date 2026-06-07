import * as z from "zod";

export const CreateCustomRoomSchema = z.object({
  customRoomKey: z
    .string()
    .min(4)
    .max(16)
    .optional()
    .describe("自定义房间密钥，长度 4 到 16；省略时自动生成"),
});

export const CustomRoomResolutionSchema = z.object({
  customRoomKey: z.string().describe("自定义房间密钥"),
  setupRoomId: z.string().describe("setup 房间 ID"),
  created: z.boolean().describe("是否新建了房间，而不是加入已有房间"),
});

export const ResolveCustomRoomParamsSchema = z.object({
  customRoomKey: z.string().describe("待解析的自定义房间密钥，长度 4 到 16"),
});
