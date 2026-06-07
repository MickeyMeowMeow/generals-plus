import * as z from "zod";

export const CreateCustomRoomSchema = z.object({
  customRoomKey: z
    .string()
    .min(4)
    .max(16)
    .optional()
    .describe("Custom room key, 4-16 characters. Auto-generated if omitted."),
});

export const CustomRoomResolutionSchema = z.object({
  customRoomKey: z.string().describe("The custom room key"),
  setupRoomId: z.string().describe("The setup room ID"),
  created: z
    .boolean()
    .describe("Whether a new room was created (vs joining existing)"),
});

export const ResolveCustomRoomParamsSchema = z.object({
  customRoomKey: z
    .string()
    .describe("Custom room key to resolve, 4-16 characters"),
});
