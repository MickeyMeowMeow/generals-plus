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
    "通过 /auth/login、/auth/register 或 /auth/anonymous 获取的 JWT 令牌",
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
      title: "Generals Plus REST API 文档",
      version: "1.0.0",
      description: "Generals Plus 游戏服务端的 REST API 文档",
    },
    servers: [{ url: "http://localhost:2567", description: "本地开发服务器" }],
  });
}
