import { JWT } from "@colyseus/auth";
import type { Request, Response } from "express";

import { createCustomRoom, resolveCustomRoom } from "./custom-room-registry";

async function getAuthorizedUserId(request: Request) {
  const header = request.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const auth = (await JWT.verify(token)) as { id?: string } | null;
  return auth?.id ?? null;
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

    const room = await createCustomRoom(ownerUserId);
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

      const resolution = await resolveCustomRoom(customRoomKey, ownerUserId);
      if (!resolution) {
        response.status(404).json({ error: "room not found" });
        return;
      }

      response.status(200).json(resolution);
    },
  );
}
