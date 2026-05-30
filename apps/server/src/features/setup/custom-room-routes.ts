import { JWT } from "@colyseus/auth";
import type { CustomRoomCreationRequest } from "@generals-plus/shared-types";
import {
  CUSTOM_ROOM_KEY_MAX_LENGTH,
  CUSTOM_ROOM_KEY_MIN_LENGTH,
  isValidCustomRoomKeyLength,
} from "@generals-plus/shared-types";
import type { Request, Response } from "express";

import {
  CustomRoomAlreadyExistsError,
  CustomRoomFullError,
  createCustomRoom,
  resolveCustomRoom,
} from "./custom-room-registry";

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

const CUSTOM_ROOM_KEY_LENGTH_ERROR = `Room id must be ${CUSTOM_ROOM_KEY_MIN_LENGTH} - ${CUSTOM_ROOM_KEY_MAX_LENGTH} characters.`;

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

    const requestedKey =
      (request.body as CustomRoomCreationRequest | undefined)?.customRoomKey ??
      undefined;
    if (requestedKey !== undefined && typeof requestedKey !== "string") {
      response.status(400).json({ error: "Invalid custom room key" });
      return;
    }
    if (requestedKey && !isValidCustomRoomKeyLength(requestedKey.trim())) {
      response.status(400).json({ error: CUSTOM_ROOM_KEY_LENGTH_ERROR });
      return;
    }

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

      const customRoomKey = request.params.customRoomKey;
      if (typeof customRoomKey !== "string") {
        response.status(400).json({ error: "Invalid custom room key" });
        return;
      }
      if (!isValidCustomRoomKeyLength(customRoomKey.trim())) {
        response.status(400).json({ error: CUSTOM_ROOM_KEY_LENGTH_ERROR });
        return;
      }

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
      if (!resolution) {
        response.status(404).json({ error: "room not found" });
        return;
      }

      response.status(200).json(resolution);
    },
  );
}
