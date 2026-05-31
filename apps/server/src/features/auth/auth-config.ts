import { auth, JWT } from "@colyseus/auth";

import { ENV } from "#/env";
import type { IUserRepository, UserCreateOptions } from "#/infra/db/interfaces";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

/**
 * Remove privileged fields from caller-supplied registration options so that
 * user-controlled input cannot override security-sensitive document fields.
 * Returns undefined when no options are provided.
 */
function sanitizeOptions(
  options: Record<string, unknown> | undefined,
): UserCreateOptions | undefined {
  if (!options) return undefined;
  const {
    password: _pw,
    verified: _v,
    ratings: _ratings,
    anonymous: _anon,
    email: _email,
    ...safe
  } = options;
  return safe;
}

// Instantiate the repository (Dependency Injection)
const userRepository: IUserRepository = new MongoUserRepository();

/**
 * Set the base URL for the backend (for redirects and OAuth)
 */
auth.backend_url = ENV.BACKEND_URL;
JWT.settings.secret = ENV.JWT_SECRET;

/**
 * Bind @colyseus/auth v0.17 callbacks to our OOP Repository
 */

// Handle Sign In / Login
auth.settings.onFindUserByEmail = async (email: string) => {
  // Must return the user object containing the 'password' field
  const user = await userRepository.findByEmail(email);

  if (user && typeof user.password === "string") {
    return user as typeof user & { password: string };
  }

  return null;
};

// Handle Registration
auth.settings.onRegisterWithEmailAndPassword = async (
  email,
  passwordHash,
  options,
) => {
  // passwordHash is already hashed by Colyseus using AUTH_SALT
  return await userRepository.createWithEmailAndPassword(
    email,
    passwordHash,
    sanitizeOptions(options),
  );
};

// Handle Anonymous Sign In
auth.settings.onRegisterAnonymously = async (options) => {
  return await userRepository.createAnonymous(sanitizeOptions(options));
};

// Handle Password Reset
auth.settings.onResetPassword = async (email: string, passwordHash: string) => {
  return await userRepository.updatePassword(email, passwordHash);
};

// Handle sending email confirmation (example using resend.com)
auth.settings.onSendEmailConfirmation = async (_email, _html, _link) => {
  // TODO: Integrate with an email service provider to send the confirmation email
};

// Handle Email Confirmation logic
auth.settings.onEmailConfirmed = async (email: string) => {
  return await userRepository.verifyEmail(email);
};

const FALLBACK_DISPLAY_NAME = "Player";

/**
 * Fetch fresh user data from the database, falling back to the provided
 * decoded payload when the user ID is missing, the lookup fails, or the
 * user record is gone. The password field is always stripped and
 * displayName is guaranteed to be a non-empty string.
 */
async function freshUserFromDB(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const userId = data.id as string | undefined;

  if (!userId) {
    const { password: _, ...safeData } = data;
    return safeData;
  }

  try {
    const user = await userRepository.findById(userId);
    if (user) {
      const { password: _, ...safeData } = user;
      return {
        ...safeData,
        displayName: safeData.displayName || FALLBACK_DISPLAY_NAME,
      };
    }
  } catch {
    // Fall through to decoded token data
  }

  const { password: _, ...safeData } = data;
  return {
    ...safeData,
    displayName: safeData.displayName || FALLBACK_DISPLAY_NAME,
  };
}

/**
 * Verify a JWT token and return fresh user data from the database.
 *
 * Used by room `onAuth` methods to ensure displayName and other fields
 * are always current, even if the JWT was issued before a profile update.
 */
export async function resolveAuthUser(
  token: string,
): Promise<Record<string, unknown>> {
  const decoded = (await JWT.verify(token)) as Record<string, unknown>;
  return freshUserFromDB(decoded);
}

// Return fresh user data from the database instead of stale JWT payload.
// This ensures fields like ratings are always up-to-date on page load.
auth.settings.onParseToken = freshUserFromDB;

export { auth };
