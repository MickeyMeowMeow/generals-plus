import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

import { registerAuthContracts } from "./auth";
import { registerCustomRoomContracts } from "./custom-room";
import { registerHealthContracts } from "./health";
import { registerMapsContracts } from "./maps";
import { registerProfileContracts } from "./profile";
import { registerSystemContracts } from "./system";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "JWT token obtained from /auth/login, /auth/register, or /auth/anonymous",
});

registerMapsContracts(registry);
registerSystemContracts(registry);
registerProfileContracts(registry);
registerAuthContracts(registry);
registerCustomRoomContracts(registry);
registerHealthContracts(registry);

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "generals+ API",
      version: "1.0.0",
      description: "API documentation for the generals+ game server",
    },
    servers: [
      { url: "http://localhost:2567", description: "Local development server" },
    ],
  });
}
