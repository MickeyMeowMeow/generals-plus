import * as z from "zod";

export const CreateCustomRoomSchema = z.object({
  customRoomKey: z
    .string()
    .min(4)
    .max(16)
    .optional()
    .describe(
      "Custom room key, 4 to 16 characters. Generated automatically when omitted",
    ),
});

export const CustomRoomResolutionSchema = z.object({
  customRoomKey: z.string().describe("Custom room key"),
  setupRoomId: z.string().describe("Setup room ID"),
  created: z
    .boolean()
    .describe("Whether a room was created instead of joining an existing one"),
});

export const ResolveCustomRoomParamsSchema = z.object({
  customRoomKey: z
    .string()
    .describe("Custom room key to resolve, 4 to 16 characters"),
});
