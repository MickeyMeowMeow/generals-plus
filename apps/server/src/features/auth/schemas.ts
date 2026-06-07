import * as z from "zod";

export const AuthUserSchema = z.object({
  id: z.string().describe("Unique user identifier"),
  email: z.string().optional().describe("User email address"),
  displayName: z.string().optional().describe("Display name"),
  anonymous: z
    .boolean()
    .optional()
    .describe("Whether the account is anonymous"),
  verified: z
    .boolean()
    .optional()
    .describe("Whether the email address has been verified"),
  ratings: z
    .record(z.string(), z.number())
    .optional()
    .describe("Ratings grouped by game mode"),
  preferences: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("User preferences object"),
  isAdmin: z
    .boolean()
    .optional()
    .describe("Whether the user is an administrator"),
});

export const RegisterSchema = z.object({
  email: z.string().email().describe("User email address"),
  password: z.string().min(1).describe("User password"),
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Additional registration options that are sanitized on the server",
    ),
});

export const LoginSchema = z.object({
  email: z.string().email().describe("User email address"),
  password: z.string().min(1).describe("User password"),
});

export const AnonymousSignInSchema = z.object({
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional initial data for an anonymous user"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().describe("User email address"),
});

export const ColyseusAdminLoginSchema = z.object({
  token: z.string().describe("JWT bearer token"),
  basePath: z
    .string()
    .optional()
    .describe("Base path where the cookie should be valid"),
});

export const AuthSuccessResponseSchema = z.object({
  token: z.string().describe("JWT bearer token"),
  user: AuthUserSchema.describe("Authenticated user payload"),
});

export const AuthUserDataResponseSchema = z.object({
  user: AuthUserSchema.describe("Authenticated user payload"),
});
