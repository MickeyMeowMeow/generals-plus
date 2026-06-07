import * as z from "zod";

export const SystemSettingsSchema = z.object({
  allowMapCreation: z
    .boolean()
    .describe("Whether non-admin users may create maps"),
  allowMapUpdates: z
    .boolean()
    .describe("Whether non-admin users may update maps"),
  systemBanner: z.string().describe("System banner message shown to all users"),
  maxMapsPerUser: z
    .number()
    .int()
    .describe("Maximum number of maps each user may own"),
  maxTotalRooms: z
    .number()
    .int()
    .describe(
      "Maximum number of game rooms that may exist at the same time, visible to administrators only",
    ),
  maxVsAiRooms: z
    .number()
    .int()
    .describe(
      "Maximum number of versus-AI rooms that may exist at the same time, visible to administrators only",
    ),
  maintenanceMode: z
    .boolean()
    .describe("Whether the system is in maintenance mode"),
});

export const PublicSystemSettingsSchema = z.object({
  allowMapCreation: z
    .boolean()
    .describe("Whether non-admin users may create maps"),
  allowMapUpdates: z
    .boolean()
    .describe("Whether non-admin users may update maps"),
  systemBanner: z.string().describe("System banner message"),
  maxMapsPerUser: z
    .number()
    .int()
    .describe("Maximum number of maps each user may own"),
  maintenanceMode: z.boolean().describe("Maintenance mode state"),
});

export const UpdateSystemSettingsSchema = SystemSettingsSchema.partial();

export type UpdateSystemSettingsInput = z.infer<
  typeof UpdateSystemSettingsSchema
>;
