import { JWT } from "@colyseus/auth";
import type { Request, Response } from "express";

import { MongoSystemSettingsRepository } from "#/infra/db/repositories/MongoSystemSettingsRepository";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

const userRepository = new MongoUserRepository();
const systemSettingsRepository = new MongoSystemSettingsRepository();

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
  // Get global settings (publicly accessible)
  app.get("/system/settings", async (_request, response) => {
    try {
      const settings = await systemSettingsRepository.getSettings();
      response.json(settings);
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
      const result = await systemSettingsRepository.updateSettings(
        request.body,
      );
      response.json(result);
    } catch (_error) {
      response.status(500).json({ error: "Failed to update system settings" });
    }
  });
}
