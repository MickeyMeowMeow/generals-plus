import type {
  ISystemSettings,
  ISystemSettingsRepository,
} from "#/infra/db/interfaces";
import { SystemSettingsModel } from "#/infra/db/models/system-settings-model";

export class MongoSystemSettingsRepository
  implements ISystemSettingsRepository
{
  async getSettings(): Promise<ISystemSettings> {
    let settings = await SystemSettingsModel.findOne().exec();
    if (!settings) {
      settings = await SystemSettingsModel.create({
        allowMapCreation: true,
        allowMapUpdates: true,
        systemBanner: "",
        maxMapsPerUser: 50,
        maxTotalRooms: 50,
        maxVsAiRooms: 20,
        maintenanceMode: false,
      });
    }
    return {
      allowMapCreation: settings.allowMapCreation,
      allowMapUpdates: settings.allowMapUpdates,
      systemBanner: settings.systemBanner,
      maxMapsPerUser: settings.maxMapsPerUser,
      maxTotalRooms: settings.maxTotalRooms,
      maxVsAiRooms: settings.maxVsAiRooms,
      maintenanceMode: settings.maintenanceMode,
    };
  }

  async updateSettings(
    update: Partial<ISystemSettings>,
  ): Promise<ISystemSettings> {
    let settings = await SystemSettingsModel.findOne().exec();
    if (!settings) {
      settings = new SystemSettingsModel();
    }
    Object.assign(settings, update);
    const saved = await settings.save();
    return {
      allowMapCreation: saved.allowMapCreation,
      allowMapUpdates: saved.allowMapUpdates,
      systemBanner: saved.systemBanner,
      maxMapsPerUser: saved.maxMapsPerUser,
      maxTotalRooms: saved.maxTotalRooms,
      maxVsAiRooms: saved.maxVsAiRooms,
      maintenanceMode: saved.maintenanceMode,
    };
  }
}
