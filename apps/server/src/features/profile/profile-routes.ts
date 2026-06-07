import { JWT } from "@colyseus/auth";
import type { Request, Response } from "express";

import { UpdateProfileSchema } from "#/features/profile/schemas";
import type { IUser } from "#/infra/db/interfaces";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

const ALLOWED_PROFILE_FIELDS = new Set(["displayName", "preferences"]);

async function getAuthorizedUserId(request: Request) {
  const header = request.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const auth = (await JWT.verify(token)) as { id?: unknown } | null;
    return typeof auth?.id === "string" && auth.id ? auth.id : null;
  } catch {
    return null;
  }
}

/** Converts repository user entities into profile response DTOs without secrets. */
function toPublicProfileUser(user: IUser) {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

/** Registers authenticated profile mutation HTTP routes. */
export function registerProfileRoutes(app: {
  patch: (
    path: string,
    handler: (request: Request, response: Response) => Promise<void>,
  ) => void;
}) {
  const userRepository = new MongoUserRepository();

  app.patch("/profile", async (request, response) => {
    const userId = await getAuthorizedUserId(request);
    if (!userId) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Reject unknown top-level fields
    if (
      typeof request.body === "object" &&
      request.body !== null &&
      !Array.isArray(request.body)
    ) {
      const unknownField = Object.keys(request.body).find(
        (field) => !ALLOWED_PROFILE_FIELDS.has(field),
      );
      if (unknownField) {
        response
          .status(400)
          .json({ error: `Unknown profile field: ${unknownField}` });
        return;
      }
    }

    const result = UpdateProfileSchema.safeParse(request.body);
    if (!result.success) {
      response
        .status(400)
        .json({ error: "Validation failed", details: result.error.issues });
      return;
    }

    // Filter out undefined optional fields so the DB only receives what was provided
    const update: Record<string, unknown> = {};
    if (result.data.displayName !== undefined) {
      update.displayName = result.data.displayName;
    }
    if (result.data.preferences !== undefined) {
      update.preferences = result.data.preferences;
    }

    const updatedUser = await userRepository.updateProfile(
      userId,
      update as Parameters<typeof userRepository.updateProfile>[1],
    );
    if (!updatedUser) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    response.status(200).json(toPublicProfileUser(updatedUser));
  });
}
