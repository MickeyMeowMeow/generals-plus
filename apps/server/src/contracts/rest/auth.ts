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
    summary: "Get the current authenticated user",
    description:
      "Resolve the current bearer token and return the authenticated user payload.",
    tags: ["auth"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "Authenticated user payload",
        content: { "application/json": { schema: AuthUserData } },
      },
      401: {
        description: "Bearer token is missing or invalid",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/register",
    summary: "Register with email and password",
    description:
      "Create a new account with an email address and password. Privileged fields in options are stripped on the server.",
    tags: ["auth"],
    request: {
      body: { content: { "application/json": { schema: RegisterSchema } } },
    },
    responses: {
      200: {
        description:
          "Registration succeeded and returned the user payload plus JWT",
        content: { "application/json": { schema: AuthSuccess } },
      },
      400: {
        description: "Email or password format is invalid",
        content: { "application/json": { schema: Error400Schema } },
      },
      401: {
        description:
          "Registration failed, for example because the email already exists",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/login",
    summary: "Sign in with email and password",
    description:
      "Authenticate with an email address and password and return a JWT.",
    tags: ["auth"],
    request: {
      body: { content: { "application/json": { schema: LoginSchema } } },
    },
    responses: {
      200: {
        description: "Login succeeded and returned the user payload plus JWT",
        content: { "application/json": { schema: AuthSuccess } },
      },
      401: {
        description: "Credentials are invalid",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/anonymous",
    summary: "Create an anonymous session",
    description:
      "Create an anonymous account. The request body can optionally include initial options.",
    tags: ["auth"],
    request: {
      body: {
        content: { "application/json": { schema: AnonymousSignInSchema } },
      },
    },
    responses: {
      200: {
        description:
          "Anonymous sign-in succeeded and returned the user payload plus JWT",
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
    summary: "Request a password reset email",
    description:
      "Trigger the password recovery flow. Whether the current runtime accepts this request depends on the auth callback configuration.",
    tags: ["auth"],
    request: {
      body: {
        content: { "application/json": { schema: ForgotPasswordSchema } },
      },
    },
    responses: {
      200: {
        description: "The password recovery handler accepted the request",
        content: {
          "application/json": {
            schema: z.union([z.boolean(), z.record(z.string(), z.unknown())]),
          },
        },
      },
      401: {
        description:
          "Password recovery is unavailable or the request was rejected",
        content: { "application/json": { schema: Error401Schema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/colyseus/login",
    summary: "Sign in to the Colyseus admin panel",
    description:
      "Exchange a JWT for the httpOnly cookie required by Colyseus Monitor. Returns HTML on failure and a 302 redirect on success.",
    tags: ["auth"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: ColyseusAdminLoginSchema } },
      },
    },
    responses: {
      302: {
        description: "Authentication cookie set and redirected to /colyseus/",
      },
      401: {
        description: "Bearer token is invalid",
        content: { "application/json": { schema: Error401Schema } },
      },
      403: {
        description: "Current user is not an administrator",
        content: { "application/json": { schema: Error403Schema } },
      },
    },
  });
}
