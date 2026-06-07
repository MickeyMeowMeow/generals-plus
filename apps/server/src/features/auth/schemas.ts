import * as z from "zod";

export const AuthUserSchema = z.object({
  id: z.string().describe("User unique identifier"),
  email: z.string().optional().describe("User email address"),
  displayName: z.string().optional().describe("Display name"),
  anonymous: z
    .boolean()
    .optional()
    .describe("Whether the account is anonymous"),
  verified: z.boolean().optional().describe("Whether the email is verified"),
  ratings: z
    .record(z.string(), z.number())
    .optional()
    .describe("Ratings keyed by game mode"),
  preferences: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("User preferences object"),
  isAdmin: z.boolean().optional().describe("Whether the user is an admin"),
});

export const RegisterSchema = z.object({
  email: z.string().email().describe("User email address"),
  password: z.string().min(1).describe("User password"),
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional registration options (sanitized server-side)"),
});

export const LoginSchema = z.object({
  email: z.string().email().describe("User email address"),
  password: z.string().min(1).describe("User password"),
});

export const AnonymousSignInSchema = z.object({
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional anonymous user initialization data"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().describe("User email address"),
});

export const ColyseusAdminLoginSchema = z.object({
  token: z.string().describe("JWT authentication token"),
  basePath: z.string().optional().describe("Base path for the cookie"),
});

export const AuthSuccessResponseSchema = z.object({
  token: z.string().describe("JWT authentication token"),
  user: AuthUserSchema.describe("Authenticated user data"),
});

export const AuthUserDataResponseSchema = z.object({
  user: AuthUserSchema.describe("Authenticated user data"),
});
