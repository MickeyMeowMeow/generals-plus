import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface ISystemSettings {
  allowMapCreation: boolean;
  allowMapUpdates: boolean;
  systemBanner: string;
  maxMapsPerUser: number;
  maxTotalRooms: number;
  maxVsAiRooms: number;
  maintenanceMode: boolean;
}

export interface ISystemSettingsDocument extends ISystemSettings, Document {}

const SystemSettingsSchema = new Schema<ISystemSettingsDocument>(
  {
    allowMapCreation: { type: Boolean, default: true },
    allowMapUpdates: { type: Boolean, default: true },
    systemBanner: { type: String, default: "" },
    maxMapsPerUser: { type: Number, default: 50 },
    maxTotalRooms: { type: Number, default: 50 },
    maxVsAiRooms: { type: Number, default: 20 },
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const SystemSettingsModel = mongoose.model<ISystemSettingsDocument>(
  "SystemSettings",
  SystemSettingsSchema,
);
