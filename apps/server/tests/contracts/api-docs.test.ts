import { describe, expect, it } from "vitest";

import { generateOpenApiSpec } from "#/contracts/rest";
import { generateAsyncApiSpec } from "#/contracts/ws";

describe("API docs generation", () => {
  it("generates the expected REST paths and security scheme", () => {
    const spec = generateOpenApiSpec() as {
      components?: { securitySchemes?: Record<string, unknown> };
      paths?: Record<string, unknown>;
    };

    expect(spec.paths).toHaveProperty("/maps");
    expect(spec.paths).toHaveProperty("/auth/login");
    expect(spec.paths).toHaveProperty("/custom-rooms");
    expect(spec.components?.securitySchemes).toHaveProperty("bearerAuth");
  });

  it("generates websocket channels with join-option metadata", () => {
    const spec = generateAsyncApiSpec() as {
      channels?: Record<string, Record<string, unknown>>;
      components?: { messages?: Record<string, unknown> };
    };

    expect(spec.channels).toHaveProperty("match");
    expect(spec.channels).toHaveProperty("setup");
    expect(spec.channels?.setup).toHaveProperty("x-colyseus-joinOptions");
    expect(spec.channels?.setup).toHaveProperty(
      "x-colyseus-roomCreationOptions",
    );
    expect(spec.components?.messages).toHaveProperty("match_action");
    expect(spec.components?.messages).toHaveProperty("queue_seat");
  });
});
