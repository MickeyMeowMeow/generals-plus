import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerProfileRoutes } from "#/features/profile/profile-routes";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@colyseus/auth", () => ({ JWT: { verify: mocks.verify } }));
vi.mock("#/infra/db/repositories/MongoUserRepository", () => ({
  MongoUserRepository: class {
    updateProfile = mocks.updateProfile;
  },
}));

type PatchHandler = (request: Request, response: Response) => Promise<void>;

function capturePatchHandler() {
  let handler: PatchHandler | null = null;
  const app = {
    patch: vi.fn((path: string, routeHandler: PatchHandler) => {
      expect(path).toBe("/profile");
      handler = routeHandler;
    }),
  };

  registerProfileRoutes(app);

  if (!handler) {
    throw new Error("PATCH /profile handler was not registered");
  }

  return handler;
}

function createRequest(options: {
  authorization?: string;
  body?: unknown;
}): Request {
  return {
    body: options.body,
    header: vi.fn((name: string) => {
      if (name.toLowerCase() === "authorization") {
        return options.authorization;
      }
      return undefined;
    }),
  } as unknown as Request;
}

function createResponse(): Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return response as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe("registerProfileRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates profile data for an authenticated user", async () => {
    const handler = capturePatchHandler();
    const updatedUser = {
      id: "user-1",
      displayName: "New Name",
      preferences: {
        backgroundImage: { source: "preset", presetId: "frontier" },
      },
    };
    mocks.verify.mockResolvedValue({ id: "user-1" });
    mocks.updateProfile.mockResolvedValue(updatedUser);

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: {
          displayName: "  New Name  ",
          preferences: {
            backgroundImage: { source: "preset", presetId: "frontier" },
          },
        },
      }),
      response,
    );

    expect(mocks.verify).toHaveBeenCalledWith("token-1");
    expect(mocks.updateProfile).toHaveBeenCalledWith("user-1", {
      displayName: "New Name",
      preferences: {
        backgroundImage: { source: "preset", presetId: "frontier" },
      },
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(updatedUser);
  });

  it("does not include password in the profile response", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockResolvedValue({ id: "user-1" });
    mocks.updateProfile.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      password: "hashed-secret",
      displayName: "New Name",
      anonymous: false,
      verified: true,
      ratings: { classic: 1200 },
      preferences: {
        backgroundImage: { source: "preset", presetId: "classic" },
      },
    });

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: { displayName: "New Name" },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      id: "user-1",
      email: "user@example.com",
      displayName: "New Name",
      anonymous: false,
      verified: true,
      ratings: { classic: 1200 },
      preferences: {
        backgroundImage: { source: "preset", presetId: "classic" },
      },
    });
    expect(response.json.mock.calls[0]?.[0]).not.toHaveProperty("password");
  });

  it("rejects custom background URLs without http or https", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockResolvedValue({ id: "user-1" });

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: {
          preferences: {
            backgroundImage: {
              source: "customUrl",
              customUrl: "ftp://example.com/bg.jpg",
            },
          },
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "Custom background URL must use http or https.",
    });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects preset background preferences with a custom URL", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockResolvedValue({ id: "user-1" });

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: {
          preferences: {
            backgroundImage: {
              source: "preset",
              presetId: "classic",
              customUrl: "https://example.com/bg.jpg",
            },
          },
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects custom URL background preferences with a preset id", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockResolvedValue({ id: "user-1" });

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: {
          preferences: {
            backgroundImage: {
              source: "customUrl",
              customUrl: "https://example.com/bg.jpg",
              presetId: "classic",
            },
          },
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects preset background preferences with an extra nested field", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockResolvedValue({ id: "user-1" });

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: {
          preferences: {
            backgroundImage: {
              source: "preset",
              presetId: "classic",
              extra: "not-allowed",
            },
          },
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "Unknown background image field: extra",
    });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects custom URL background preferences with an extra nested field", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockResolvedValue({ id: "user-1" });

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: {
          preferences: {
            backgroundImage: {
              source: "customUrl",
              customUrl: "https://example.com/bg.jpg",
              foo: "not-allowed",
            },
          },
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "Unknown background image field: foo",
    });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects missing auth with 401", async () => {
    const handler = capturePatchHandler();

    const response = createResponse();
    await handler(
      createRequest({ body: { displayName: "New Name" } }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects invalid bearer tokens with 401", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockRejectedValue(new Error("invalid token"));

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: { displayName: "New Name" },
      }),
      response,
    );

    expect(mocks.verify).toHaveBeenCalledWith("token-1");
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects unknown top-level fields", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockResolvedValue({ id: "user-1" });

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: { displayName: "New Name", email: "drift@example.com" },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "Unknown profile field: email",
    });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("returns 404 when repository returns null", async () => {
    const handler = capturePatchHandler();
    mocks.verify.mockResolvedValue({ id: "missing-user" });
    mocks.updateProfile.mockResolvedValue(null);

    const response = createResponse();
    await handler(
      createRequest({
        authorization: "Bearer token-1",
        body: { displayName: "New Name" },
      }),
      response,
    );

    expect(mocks.updateProfile).toHaveBeenCalledWith("missing-user", {
      displayName: "New Name",
    });
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: "User not found." });
  });
});
