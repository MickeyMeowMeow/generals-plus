import { JWT } from "@colyseus/auth";
import type {
  AvatarPreference,
  BackgroundPresetId,
  StageAppearancePreference,
  UserPreferences,
} from "@generals-plus/shared-types";
import { BACKGROUND_PRESETS } from "@generals-plus/shared-types";
import type { Request, Response } from "express";

import type { IUser, UserProfileUpdate } from "#/infra/db/interfaces";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

const ALLOWED_PROFILE_FIELDS = new Set(["displayName", "preferences"]);
const BACKGROUND_PRESET_IDS = new Set(
  BACKGROUND_PRESETS.map((preset) => preset.id),
);
const PRESET_BACKGROUND_FIELDS = new Set(["source", "presetId"]);
const CUSTOM_URL_BACKGROUND_FIELDS = new Set(["source", "customUrl"]);
const DEFAULT_AVATAR_FIELDS = new Set(["source"]);
const CUSTOM_URL_AVATAR_FIELDS = new Set(["source", "customUrl"]);
const STAGE_APPEARANCE_FIELDS = new Set(["backdropBlur", "backdropOpacity"]);
const ALLOWED_PREFERENCE_FIELDS = new Set([
  "backgroundImage",
  "avatar",
  "stageAppearance",
]);

type ProfilePatchBody = {
  displayName?: unknown;
  preferences?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBackgroundPresetId(value: string): value is BackgroundPresetId {
  return BACKGROUND_PRESET_IDS.has(value as BackgroundPresetId);
}

function findUnknownField(
  value: Record<string, unknown>,
  allowedFields: Set<string>,
) {
  return Object.keys(value).find((field) => !allowedFields.has(field));
}

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

/** Validates the request body and returns only repository-owned profile fields. */
function parseProfileUpdate(
  body: unknown,
): { ok: true; update: UserProfileUpdate } | { ok: false; error: string } {
  if (!isRecord(body)) {
    return { ok: false, error: "Profile update body must be an object." };
  }

  const unknownField = Object.keys(body).find(
    (field) => !ALLOWED_PROFILE_FIELDS.has(field),
  );
  if (unknownField) {
    return { ok: false, error: `Unknown profile field: ${unknownField}` };
  }

  const update: UserProfileUpdate = {};
  const profileBody = body as ProfilePatchBody;

  if ("displayName" in profileBody) {
    if (typeof profileBody.displayName !== "string") {
      return { ok: false, error: "Display name must be a string." };
    }

    const displayName = profileBody.displayName.trim();
    if (!displayName) {
      return { ok: false, error: "Display name cannot be empty." };
    }

    if (displayName.length > 32) {
      return { ok: false, error: "Display name is too long." };
    }

    update.displayName = displayName;
  }

  if ("preferences" in profileBody) {
    const preferences = normalizePreferences(profileBody.preferences);
    if (!preferences.ok) return preferences;
    update.preferences = preferences.preferences;
  }

  return { ok: true, update };
}

/** Normalizes the discriminated preferences payload accepted at the HTTP boundary. */
function normalizePreferences(
  value: unknown,
): { ok: true; preferences: UserPreferences } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Preferences must be an object." };
  }

  const unexpectedPreferenceField = Object.keys(value).find(
    (field) => !ALLOWED_PREFERENCE_FIELDS.has(field),
  );
  if (unexpectedPreferenceField) {
    return {
      ok: false,
      error: `Unknown preferences field: ${unexpectedPreferenceField}`,
    };
  }

  const backgroundImage = normalizeBackgroundImage(value.backgroundImage);
  if (!backgroundImage.ok) return backgroundImage;

  const avatar = normalizeAvatar(value.avatar);
  if (!avatar.ok) return avatar;

  const stageAppearance = normalizeStageAppearance(value.stageAppearance);
  if (!stageAppearance.ok) return stageAppearance;

  return {
    ok: true,
    preferences: {
      backgroundImage: backgroundImage.backgroundImage,
      avatar: avatar.avatar,
      stageAppearance: stageAppearance.stageAppearance,
    },
  };
}

/** Ensures background images are one of the supported discriminated variants. */
function normalizeBackgroundImage(
  value: unknown,
):
  | { ok: true; backgroundImage: UserPreferences["backgroundImage"] }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Background image preference must be an object.",
    };
  }

  if (value.source === "preset") {
    if ("customUrl" in value) {
      return {
        ok: false,
        error: "Preset background cannot include a customUrl.",
      };
    }
    const unknownField = findUnknownField(value, PRESET_BACKGROUND_FIELDS);
    if (unknownField) {
      return {
        ok: false,
        error: `Unknown background image field: ${unknownField}`,
      };
    }
    if (typeof value.presetId !== "string") {
      return { ok: false, error: "Preset background requires a presetId." };
    }
    if (!isBackgroundPresetId(value.presetId)) {
      return { ok: false, error: "Unknown background preset." };
    }

    return {
      ok: true,
      backgroundImage: { source: "preset", presetId: value.presetId },
    };
  }

  if (value.source === "customUrl") {
    if ("presetId" in value) {
      return {
        ok: false,
        error: "Custom background cannot include a presetId.",
      };
    }
    const unknownField = findUnknownField(value, CUSTOM_URL_BACKGROUND_FIELDS);
    if (unknownField) {
      return {
        ok: false,
        error: `Unknown background image field: ${unknownField}`,
      };
    }
    if (typeof value.customUrl !== "string") {
      return { ok: false, error: "Custom background requires a customUrl." };
    }

    const customUrl = value.customUrl.trim();
    if (!isHttpUrl(customUrl)) {
      return {
        ok: false,
        error: "Custom background URL must use http or https.",
      };
    }

    return {
      ok: true,
      backgroundImage: { source: "customUrl", customUrl },
    };
  }

  return { ok: false, error: "Background image source is invalid." };
}

/** Validates avatar preference following the same discriminated union pattern. */
function normalizeAvatar(
  value: unknown,
): { ok: true; avatar: AvatarPreference } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Avatar preference must be an object." };
  }

  if (value.source === "default") {
    const unknownField = findUnknownField(value, DEFAULT_AVATAR_FIELDS);
    if (unknownField) {
      return {
        ok: false,
        error: `Unknown avatar field: ${unknownField}`,
      };
    }
    return { ok: true, avatar: { source: "default" } };
  }

  if (value.source === "customUrl") {
    const unknownField = findUnknownField(value, CUSTOM_URL_AVATAR_FIELDS);
    if (unknownField) {
      return {
        ok: false,
        error: `Unknown avatar field: ${unknownField}`,
      };
    }
    if (typeof value.customUrl !== "string") {
      return { ok: false, error: "Custom avatar requires a customUrl." };
    }
    const customUrl = value.customUrl.trim();
    if (!isHttpUrl(customUrl)) {
      return {
        ok: false,
        error: "Custom avatar URL must use http or https.",
      };
    }
    return { ok: true, avatar: { source: "customUrl", customUrl } };
  }

  return { ok: false, error: "Avatar source is invalid." };
}

/** Validates stage appearance preference fields. */
function normalizeStageAppearance(
  value: unknown,
):
  | { ok: true; stageAppearance: StageAppearancePreference }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "Stage appearance preference must be an object.",
    };
  }

  const unknownField = findUnknownField(value, STAGE_APPEARANCE_FIELDS);
  if (unknownField) {
    return {
      ok: false,
      error: `Unknown stage appearance field: ${unknownField}`,
    };
  }

  if ("backdropBlur" in value && typeof value.backdropBlur !== "boolean") {
    return { ok: false, error: "backdropBlur must be a boolean." };
  }

  if ("backdropOpacity" in value) {
    if (typeof value.backdropOpacity !== "number") {
      return { ok: false, error: "backdropOpacity must be a number." };
    }
    if (value.backdropOpacity < 0 || value.backdropOpacity > 100) {
      return {
        ok: false,
        error: "backdropOpacity must be between 0 and 100.",
      };
    }
  }

  return {
    ok: true,
    stageAppearance: {
      backdropBlur:
        "backdropBlur" in value ? (value.backdropBlur as boolean) : true,
      backdropOpacity:
        "backdropOpacity" in value ? (value.backdropOpacity as number) : 58,
    },
  };
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
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

    const profileUpdate = parseProfileUpdate(request.body);
    if (!profileUpdate.ok) {
      response.status(400).json({ error: profileUpdate.error });
      return;
    }

    const updatedUser = await userRepository.updateProfile(
      userId,
      profileUpdate.update,
    );
    if (!updatedUser) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    response.status(200).json(toPublicProfileUser(updatedUser));
  });
}
