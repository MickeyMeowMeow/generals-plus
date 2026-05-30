import type { GameMode } from "@generals-plus/engine";
import type { UserPreferences } from "@generals-plus/shared-types";

import type { IPlayerRatings } from "#/infra/db/models/user-model";

/**
 * User entity representing the core data structure.
 */
export interface IUser {
  id: string; // Mongoose _id as string
  email?: string;
  password?: string; // Hashed password
  displayName?: string; // Display name
  anonymous?: boolean;
  verified?: boolean;
  ratings?: IPlayerRatings;
  preferences?: UserPreferences;
}

export type UserCreateOptions = Record<string, unknown>;

/** Profile fields that can be updated by a user. */
export interface UserProfileUpdate {
  displayName?: string;
  preferences?: UserPreferences;
}

/**
 * Repository interface for User Database operations.
 * Decouples the Auth logic from the specific database implementation (MongoDB).
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<IUser | null>;
  createWithEmailAndPassword(
    email: string,
    passwordHash: string,
    options?: UserCreateOptions,
  ): Promise<IUser>;
  createAnonymous(options?: UserCreateOptions): Promise<IUser>;
  updatePassword(email: string, newPasswordHash: string): Promise<boolean>;
  verifyEmail(email: string): Promise<boolean>;
  /** Updates mutable profile fields for a user and returns the updated entity. */
  updateProfile(
    userId: string,
    update: UserProfileUpdate,
  ): Promise<IUser | null>;
  getRating(userId: string, mode: GameMode): Promise<number>;
  updateRatings(
    updates: Array<{ userId: string; mode: GameMode; newRating: number }>,
  ): Promise<void>;
}
