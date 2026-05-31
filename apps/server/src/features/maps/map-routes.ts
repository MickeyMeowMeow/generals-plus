import { JWT } from "@colyseus/auth";
import type { GameMode } from "@generals-plus/engine";
import type { Request, Response } from "express";

import { createMapSchema, updateMapSchema } from "#/features/maps/schemas";
import { validateMapGrid } from "#/features/maps/validate-map";
import { MongoMapRepository } from "#/infra/db/repositories/MongoMapRepository";

const mapRepository = new MongoMapRepository();

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
  app.get("/api/maps", async (request, response) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 20));
    const mode = request.query.mode as GameMode | undefined;
    const sort = request.query.sort as "plays" | "likes" | "date" | undefined;

    try {
      const result = await mapRepository.findPublished({
        page,
        limit,
        mode,
        sort,
      });
      response.json(result);
    } catch (_error) {
      response.status(500).json({ error: "Failed to fetch maps" });
    }
  });

  // Get single map
  app.get("/api/maps/:id", async (request, response) => {
    const map = await mapRepository.findById(getParam(request.params, "id"));
    if (!map) {
      response.status(404).json({ error: "Map not found" });
      return;
    }
    response.json(map);
  });

  // Create map
  app.post("/api/maps", async (request, response) => {
    const user = await getAuthorizedUser(request);
    if (!user) {
      response.status(401).json({ error: "Unauthorized" });
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
  app.put("/api/maps/:id", async (request, response) => {
    const userId = await getAuthorizedUserId(request);
    if (!userId) {
      response.status(401).json({ error: "Unauthorized" });
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
  app.delete("/api/maps/:id", async (request, response) => {
    const userId = await getAuthorizedUserId(request);
    if (!userId) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const deleted = await mapRepository.delete(
      getParam(request.params, "id"),
      userId,
    );
    if (!deleted) {
      response.status(404).json({ error: "Map not found or not authorized" });
      return;
    }
    response.status(204).end();
  });

  // Toggle like
  app.post("/api/maps/:id/like", async (request, response) => {
    const userId = await getAuthorizedUserId(request);
    if (!userId) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const result = await mapRepository.toggleLike(
        getParam(request.params, "id"),
        userId,
      );
      response.json({ result });
    } catch (_error) {
      response.status(500).json({ error: "Failed to toggle like" });
    }
  });
}
