import { JWT } from "@colyseus/auth";
import type { Request, Response } from "express";

import {
  CustomRoomAlreadyExistsError,
  CustomRoomFullError,
  createCustomRoom,
  resolveCustomRoom,
} from "#/features/setup/custom-room-registry";
import {
  CreateCustomRoomSchema,
  ResolveCustomRoomParamsSchema,
} from "#/features/setup/custom-room-schemas";

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

export function registerCustomRoomRoutes(app: {
  post: (
    path: string,
    handler: (request: Request, response: Response) => Promise<void>,
  ) => void;
}) {
  app.post("/custom-rooms", async (request, response) => {
    const ownerUserId = await getAuthorizedUserId(request);
    if (!ownerUserId) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = CreateCustomRoomSchema.safeParse(request.body);
    if (!result.success) {
      response
        .status(400)
        .json({ error: "Validation failed", details: result.error.issues });
      return;
    }

    const requestedKey = result.data.customRoomKey?.trim() || undefined;

    let room = null;
    try {
      room = await createCustomRoom(ownerUserId, requestedKey);
    } catch (error) {
      if (error instanceof CustomRoomAlreadyExistsError) {
        response.status(409).json({ error: "room already exists" });
        return;
      }
      throw error;
    }
    response.status(201).json(room);
  });

  app.post(
    "/custom-rooms/:customRoomKey/resolve",
    async (request, response) => {
      const ownerUserId = await getAuthorizedUserId(request);
      if (!ownerUserId) {
        response.status(401).json({ error: "Unauthorized" });
        return;
      }

      const paramsResult = ResolveCustomRoomParamsSchema.safeParse(
        request.params,
      );
      if (!paramsResult.success) {
        response.status(400).json({
          error: "Validation failed",
          details: paramsResult.error.issues,
        });
        return;
      }

      const customRoomKey = paramsResult.data.customRoomKey.trim();

      let resolution = null;
      try {
        resolution = await resolveCustomRoom(customRoomKey, ownerUserId);
      } catch (error) {
        if (error instanceof CustomRoomFullError) {
          response
            .status(409)
            .json({ error: "Room is full. Ask the host for more capacity." });
          return;
        }
        throw error;
      }

      response.status(200).json(resolution);
    },
  );
}
