import * as z from "zod";

export const SystemSettingsSchema = z.object({
  allowMapCreation: z
    .boolean()
    .describe("Whether non-admin users can create maps"),
  allowMapUpdates: z
    .boolean()
    .describe("Whether non-admin users can update maps"),
  systemBanner: z
    .string()
    .describe("System-wide banner message displayed to users"),
  maxMapsPerUser: z.number().int().describe("Maximum number of maps per user"),
  maxTotalRooms: z
    .number()
    .int()
    .describe("Maximum total concurrent game rooms (admin-only)"),
  maxVsAiRooms: z
    .number()
    .int()
    .describe("Maximum concurrent vs-AI rooms (admin-only)"),
  maintenanceMode: z
    .boolean()
    .describe("Whether the system is in maintenance mode"),
});

export const PublicSystemSettingsSchema = z.object({
  allowMapCreation: z
    .boolean()
    .describe("Whether non-admin users can create maps"),
  allowMapUpdates: z
    .boolean()
    .describe("Whether non-admin users can update maps"),
  systemBanner: z.string().describe("System-wide banner message"),
  maxMapsPerUser: z.number().int().describe("Maximum maps per user"),
  maintenanceMode: z.boolean().describe("Maintenance mode status"),
});

export const UpdateSystemSettingsSchema = SystemSettingsSchema.partial();

export type UpdateSystemSettingsInput = z.infer<
  typeof UpdateSystemSettingsSchema
>;
