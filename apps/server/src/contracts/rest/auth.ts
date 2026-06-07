import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import * as z from "zod";

import {
  AnonymousSignInSchema,
  AuthSuccessResponseSchema,
  AuthUserDataResponseSchema,
  ColyseusAdminLoginSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
} from "#/features/auth/schemas";
import {
  Error400Schema,
  Error401Schema,
  Error403Schema,
} from "#/schemas/common";

export function registerAuthContracts(registry: OpenAPIRegistry) {
  const AuthSuccess = AuthSuccessResponseSchema.meta({
    id: "AuthSuccessResponse",
  });
  const AuthUserData = AuthUserDataResponseSchema.meta({
    id: "AuthUserDataResponse",
  });

  registry.registerPath({
    method: "get",
    path: "/auth/userdata",
    summary: "Get authenticated user data",
    description:
      "Resolve the current bearer token and return the authenticated user payload.",
    tags: ["Authentication"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "Authenticated user data",
        content: { "application/json": { schema: AuthUserData } },
      },
      401: {
        description: "Invalid or missing token",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/register",
    summary: "Register with email and password",
    description:
      "Create a new account with email and password. Privileged fields are stripped from options server-side.",
    tags: ["Authentication"],
    request: {
      body: { content: { "application/json": { schema: RegisterSchema } } },
    },
    responses: {
      200: {
        description: "Registration successful, returns user + JWT",
        content: { "application/json": { schema: AuthSuccess } },
      },
      400: {
        description: "Malformed email or password",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description: "Registration failed, such as duplicate email",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/login",
    summary: "Login with email and password",
    description: "Authenticate with email and password. Returns a JWT token.",
    tags: ["Authentication"],
    request: {
      body: { content: { "application/json": { schema: LoginSchema } } },
    },
    responses: {
      200: {
        description: "Login successful, returns user + JWT",
        content: { "application/json": { schema: AuthSuccess } },
      },
      401: {
        description: "Invalid credentials",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/anonymous",
    summary: "Anonymous sign-in",
    description:
      "Create an anonymous account. A body with optional options may be supplied.",
    tags: ["Authentication"],
    request: {
      body: {
        content: { "application/json": { schema: AnonymousSignInSchema } },
      },
    },
    responses: {
      200: {
        description: "Anonymous sign-in successful, returns user + JWT",
        content: { "application/json": { schema: AuthSuccess } },
      },
      401: {
        description: "Anonymous sign-in failed",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/forgot-password",
    summary: "Request password reset email",
    description:
      "Trigger the forgot-password flow. The current runtime may reject the request depending on auth callback wiring.",
    tags: ["Authentication"],
    request: {
      body: {
        content: { "application/json": { schema: ForgotPasswordSchema } },
      },
    },
    responses: {
      200: {
        description: "Forgot-password handler accepted the request",
        content: {
          "application/json": {
            schema: z.union([z.boolean(), z.record(z.string(), z.unknown())]),
          },
        },
      },
      401: {
        description: "Forgot-password flow unavailable or request rejected",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/colyseus/login",
    summary: "Admin monitor login",
    description:
      "Exchange a JWT token for an httpOnly cookie to access the Colyseus Monitor. Returns HTML on errors and a 302 redirect on success.",
    tags: ["Authentication"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: ColyseusAdminLoginSchema } },
      },
    },
    responses: {
      302: { description: "Redirect to /colyseus/ with auth cookie set" },
      401: {
        description: "Invalid token",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "Not an admin",
        content: { "application/json": { schema: Error403Schema } },
      },
    },
  });
}
