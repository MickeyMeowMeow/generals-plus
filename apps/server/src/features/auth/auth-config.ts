import { auth } from "@colyseus/auth";

import { ENV } from "@/env";
import type { IUserRepository, UserCreateOptions } from "@/infra/db/interfaces";
import { MongoUserRepository } from "@/infra/db/repositories/MongoUserRepository";

/**
 * Remove privileged fields from caller-supplied registration options so that
 * user-controlled input cannot override security-sensitive document fields.
 */
function sanitizeOptions(options: Record<string, unknown>): UserCreateOptions {
  const {
    password: _pw,
    verified: _v,
    elo: _elo,
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
    options ? sanitizeOptions(options) : undefined,
  );
};

// Handle Anonymous Sign In
auth.settings.onRegisterAnonymously = async (options) => {
  return await userRepository.createAnonymous(
    options ? sanitizeOptions(options) : undefined,
  );
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

// Filter user data before sending to client (remove password)
auth.settings.onParseToken = async (data: Record<string, unknown>) => {
  const safeData = { ...data };
  delete safeData.password;
  return safeData;
};

export { auth };
