import { JWT } from "@colyseus/auth";
import type { Request, Response } from "express";

import { UpdateSystemSettingsSchema } from "#/features/system/schemas";
import type { ISystemSettings } from "#/infra/db/interfaces";
import { MongoSystemSettingsRepository } from "#/infra/db/repositories/MongoSystemSettingsRepository";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

const userRepository = new MongoUserRepository();
const systemSettingsRepository = new MongoSystemSettingsRepository();

type SettingsListener = (settings: ISystemSettings) => void;
const settingsListeners = new Set<SettingsListener>();

function broadcastSettings(settings: ISystemSettings) {
  for (const listener of settingsListeners) {
    listener(settings);
  }
}

async function getAuthorizedUser(request: Request) {
  const header = request.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const auth = (await JWT.verify(token)) as {
      id?: string;
    } | null;
    if (!auth?.id) return null;
    return await userRepository.findById(auth.id);
  } catch {
    return null;
  }
}

export function registerSystemRoutes(app: {
  get: (
    path: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) => void;
  put: (
    path: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) => void;
}) {
  // SSE stream for real-time settings updates
  app.get("/system/settings/stream", async (request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send current settings immediately on connect
    try {
      const settings = await systemSettingsRepository.getSettings();
      response.write(`data: ${JSON.stringify(settings)}\n\n`);
    } catch {
      // If initial fetch fails, client will retry on reconnect
    }

    const listener: SettingsListener = (settings) => {
      response.write(`data: ${JSON.stringify(settings)}\n\n`);
    };

    settingsListeners.add(listener);

    request.on("close", () => {
      settingsListeners.delete(listener);
    });
  });

  // Get global settings (publicly accessible, but filters sensitive fields for non-admins)
  app.get("/system/settings", async (request, response) => {
    try {
      const settings = await systemSettingsRepository.getSettings();
      const user = await getAuthorizedUser(request);
      if (user?.isAdmin) {
        response.json(settings);
      } else {
        response.json({
          allowMapCreation: settings.allowMapCreation,
          allowMapUpdates: settings.allowMapUpdates,
          systemBanner: settings.systemBanner,
          maxMapsPerUser: settings.maxMapsPerUser,
          maintenanceMode: settings.maintenanceMode,
        });
      }
    } catch (_error) {
      response.status(500).json({ error: "Failed to fetch system settings" });
    }
  });

  // Update global settings (Admins only)
  app.put("/system/settings", async (request, response) => {
    const user = await getAuthorizedUser(request);
    if (!user) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!user.isAdmin) {
      response.status(403).json({ error: "Forbidden: Administrators only" });
      return;
    }

    try {
      const validation = UpdateSystemSettingsSchema.safeParse(request.body);
      if (!validation.success) {
        response.status(400).json({
          error: "Validation failed",
          details: validation.error.issues,
        });
        return;
      }

      const result = await systemSettingsRepository.updateSettings(
        validation.data,
      );
      broadcastSettings(result);
      response.json(result);
    } catch (_error) {
      response.status(500).json({ error: "Failed to update system settings" });
    }
  });
}
