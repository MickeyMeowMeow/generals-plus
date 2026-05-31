import type { GameMode } from "@generals-plus/engine";
import type { UserPreferences } from "@generals-plus/shared-types";

import type { IMapDocument } from "#/infra/db/models/map-model";
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
  isAdmin?: boolean;
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
  findById(id: string): Promise<IUser | null>;
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

export interface IMap {
  id: string;
  name: string;
  description: string;
  authorId: string;
  authorName: string;
  grid: IMapDocument["grid"];
  supportedModes: GameMode[];
  minPlayers: number;
  maxPlayers: number;
  tags: string[];
  status: "draft" | "published";
  stats: { plays: number; likes: number };
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MapCreateOptions {
  name: string;
  description?: string;
  grid: IMapDocument["grid"];
  supportedModes: GameMode[];
  minPlayers: number;
  maxPlayers: number;
  tags?: string[];
  status?: "draft" | "published";
  thumbnail?: string;
}

export interface MapUpdateOptions {
  name?: string;
  description?: string;
  grid?: IMapDocument["grid"];
  supportedModes?: GameMode[];
  minPlayers?: number;
  maxPlayers?: number;
  tags?: string[];
  status?: "draft" | "published";
  thumbnail?: string;
}

export interface IMapRepository {
  create(
    authorId: string,
    authorName: string,
    options: MapCreateOptions,
  ): Promise<IMap>;
  findById(id: string): Promise<IMap | null>;
  findByAuthor(authorId: string): Promise<IMap[]>;
  findPublished(options: {
    page?: number;
    limit?: number;
    mode?: GameMode;
    sort?: "plays" | "likes" | "date";
  }): Promise<{ maps: IMap[]; total: number }>;
  update(
    id: string,
    authorId: string,
    update: MapUpdateOptions,
  ): Promise<IMap | null>;
  delete(id: string, authorId?: string): Promise<boolean>;
  incrementPlays(id: string): Promise<void>;
  toggleLike(id: string, userId: string): Promise<"liked" | "unliked">;
}

export interface ISystemSettings {
  allowMapCreation: boolean;
  allowMapUpdates: boolean;
  systemBanner: string;
  maxMapsPerUser: number;
  maxTotalRooms: number;
  maxVsAiRooms: number;
  maintenanceMode: boolean;
}

export interface ISystemSettingsRepository {
  getSettings(): Promise<ISystemSettings>;
  updateSettings(settings: Partial<ISystemSettings>): Promise<ISystemSettings>;
}
