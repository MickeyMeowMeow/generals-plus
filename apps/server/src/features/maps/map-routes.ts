import { JWT } from "@colyseus/auth";
import type { GameMode } from "@generals-plus/engine";
import type { Request, Response } from "express";

import { createMapSchema, updateMapSchema } from "#/features/maps/schemas";
import { validateMapGrid } from "#/features/maps/validate-map";
import { MongoMapRepository } from "#/infra/db/repositories/MongoMapRepository";
import { MongoSystemSettingsRepository } from "#/infra/db/repositories/MongoSystemSettingsRepository";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

const mapRepository = new MongoMapRepository();
const userRepository = new MongoUserRepository();
const systemSettingsRepository = new MongoSystemSettingsRepository();

function getParam(
  params: Record<string, string | string[]>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function getAuthorizedUserId(request: Request) {
  const header = request.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const auth = (await JWT.verify(token)) as { id?: string } | null;
    return auth?.id ?? null;
  } catch {
    return null;
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
      displayName?: string;
    } | null;
    if (!auth?.id) return null;
    return { id: auth.id, displayName: auth.displayName ?? "Anonymous" };
  } catch {
    return null;
  }
}

export function registerMapRoutes(app: {
  get: (
    path: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) => void;
  post: (
    path: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) => void;
  put: (
    path: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) => void;
  delete: (
    path: string,
    handler: (req: Request, res: Response) => Promise<void>,
  ) => void;
}) {
  // List published maps
  app.get("/maps", async (request, response) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 20));
    const mode = request.query.mode as GameMode | undefined;
    const sort = request.query.sort as "plays" | "likes" | "date" | undefined;
    const search = request.query.search as string | undefined;

    try {
      const result = await mapRepository.findPublished({
        page,
        limit,
        mode,
        sort,
        search,
      });
      response.json(result);
    } catch (_error) {
      response.status(500).json({ error: "Failed to fetch maps" });
    }
  });

  // Get single map
  app.get("/maps/:id", async (request, response) => {
    const map = await mapRepository.findById(getParam(request.params, "id"));
    if (!map) {
      response.status(404).json({ error: "Map not found" });
      return;
    }
    response.json(map);
  });

  // Create map
  app.post("/maps", async (request, response) => {
    const user = await getAuthorizedUser(request);
    if (!user) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const fullUser = await userRepository.findById(user.id);
    const isAdmin = fullUser?.isAdmin || false;

    // Check system settings
    const settings = await systemSettingsRepository.getSettings();
    if (!settings.allowMapCreation && !isAdmin) {
      response.status(403).json({
        error: "Map creation is temporarily disabled by the administrator",
      });
      return;
    }

    // Check map limit
    const userMaps = await mapRepository.findByAuthor(user.id);
    if (userMaps.length >= settings.maxMapsPerUser && !isAdmin) {
      response.status(400).json({
        error: `You have reached the maximum limit of ${settings.maxMapsPerUser} maps. Please delete some maps before creating a new one.`,
      });
      return;
    }

    const result = createMapSchema.safeParse(request.body);
    if (!result.success) {
      response
        .status(400)
        .json({ error: "Validation failed", details: result.error.issues });
      return;
    }

    const data = result.data;

    // Validate grid structure and connectivity
    const gridValidation = validateMapGrid(data.grid);
    if (!gridValidation.valid) {
      response
        .status(400)
        .json({ error: "Invalid grid", details: gridValidation.errors });
      return;
    }

    try {
      const map = await mapRepository.create(user.id, user.displayName, data);
      response.status(201).json(map);
    } catch (_error) {
      response.status(500).json({ error: "Failed to create map" });
    }
  });

  // Update map
  app.put("/maps/:id", async (request, response) => {
    const userId = await getAuthorizedUserId(request);
    if (!userId) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const fullUser = await userRepository.findById(userId);
    const isAdmin = fullUser?.isAdmin || false;

    // Check system settings
    const settings = await systemSettingsRepository.getSettings();
    if (!settings.allowMapUpdates && !isAdmin) {
      response.status(403).json({
        error: "Map updates are temporarily disabled by the administrator",
      });
      return;
    }

    const result = updateMapSchema.safeParse(request.body);
    if (!result.success) {
      response
        .status(400)
        .json({ error: "Validation failed", details: result.error.issues });
      return;
    }

    // If grid is being updated, validate it
    if (result.data.grid) {
      const gridValidation = validateMapGrid(result.data.grid);
      if (!gridValidation.valid) {
        response
          .status(400)
          .json({ error: "Invalid grid", details: gridValidation.errors });
        return;
      }
    }

    try {
      const map = await mapRepository.update(
        getParam(request.params, "id"),
        userId,
        result.data,
      );
      if (!map) {
        response.status(404).json({ error: "Map not found or not authorized" });
        return;
      }
      response.json(map);
    } catch (_error) {
      response.status(500).json({ error: "Failed to update map" });
    }
  });

  // Delete map
  app.delete("/maps/:id", async (request, response) => {
    const userId = await getAuthorizedUserId(request);
    if (!userId) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const fullUser = await userRepository.findById(userId);
    const isAdmin = fullUser?.isAdmin || false;

    const deleted = await mapRepository.delete(
      getParam(request.params, "id"),
      isAdmin ? undefined : userId,
    );
    if (!deleted) {
      response.status(404).json({ error: "Map not found or not authorized" });
      return;
    }
    response.status(204).end();
  });

  // Toggle like
  app.post("/maps/:id/like", async (request, response) => {
    const userId = await getAuthorizedUserId(request);
    if (!userId) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = getParam(request.params, "id");
    const map = await mapRepository.findById(id);
    if (!map) {
      response.status(404).json({ error: "Map not found" });
      return;
    }

    try {
      const result = await mapRepository.toggleLike(id, userId);
      response.json({ result });
    } catch (_error) {
      response.status(500).json({ error: "Failed to toggle like" });
    }
  });
}
