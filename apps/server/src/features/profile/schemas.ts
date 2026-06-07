import * as z from "zod";

const BackgroundPresetIdSchema = z.enum(["default", "touhou"]);

export const BackgroundImageSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("preset").describe("Use a built-in background preset"),
    presetId: BackgroundPresetIdSchema.describe("Preset identifier"),
  }),
  z.object({
    source: z
      .literal("customUrl")
      .describe("Use a custom background image URL"),
    customUrl: z.string().describe("HTTP or HTTPS URL of the background image"),
  }),
]);

export const AvatarSchema = z.discriminatedUnion("source", [
  z.object({
    source: z
      .literal("default")
      .describe("Use the default initial-letter avatar"),
  }),
  z.object({
    source: z.literal("customUrl").describe("Use a custom avatar image URL"),
    customUrl: z.string().describe("HTTP or HTTPS URL of the avatar image"),
  }),
]);

export const MotionSchema = z.object({
  mode: z
    .enum(["system", "full", "reduced"])
    .describe(
      "Motion preference: system follows OS, full enables all, reduced minimizes",
    ),
});

export const StageAppearanceSchema = z.object({
  backdropBlur: z
    .boolean()
    .default(true)
    .describe("Whether the backdrop blur effect is enabled"),
  backdropOpacity: z
    .number()
    .min(0)
    .max(100)
    .default(58)
    .describe("Backdrop overlay opacity, 0-100"),
});

export const UserPreferencesSchema = z.object({
  backgroundImage: BackgroundImageSchema.describe(
    "Background image preference",
  ),
  avatar: AvatarSchema.describe("Avatar preference"),
  motion: MotionSchema.describe("Motion preference"),
  stageAppearance: StageAppearanceSchema.describe(
    "Stage backdrop visual controls",
  ),
});

export const UpdateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(32)
    .describe("Display name, 1-32 characters after trimming")
    .optional(),
  preferences: UserPreferencesSchema.describe(
    "Full user preferences object",
  ).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const PublicUserSchema = z.object({
  id: z.string().describe("User unique identifier"),
  email: z.string().optional().describe("User email address"),
  displayName: z.string().optional().describe("Display name"),
  anonymous: z
    .boolean()
    .optional()
    .describe("Whether the account is anonymous"),
  verified: z.boolean().optional().describe("Whether the email is verified"),
  ratings: z
    .record(z.string(), z.number())
    .optional()
    .describe("ELO ratings per game mode"),
  preferences: UserPreferencesSchema.optional().describe("User preferences"),
  isAdmin: z.boolean().optional().describe("Whether the user is an admin"),
});
