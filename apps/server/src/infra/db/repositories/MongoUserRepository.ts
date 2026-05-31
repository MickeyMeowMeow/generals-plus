import type { GameMode } from "@generals-plus/engine";

import { ENV } from "#/env";
import type {
  IUser,
  IUserRepository,
  UserCreateOptions,
  UserProfileUpdate,
} from "#/infra/db/interfaces";
import type { IUserDocument } from "#/infra/db/models/user-model";
import { UserModel } from "#/infra/db/models/user-model";

/**
 * MongoDB implementation of the IUserRepository using Mongoose.
 */
export class MongoUserRepository implements IUserRepository {
  private mapToEntity(doc: IUserDocument): IUser {
    const adminEmails = ENV.ADMIN_EMAILS
      ? ENV.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
      : [];
    const emailIsAdmin = doc.email
      ? adminEmails.includes(doc.email.trim().toLowerCase())
      : false;
    return {
      id: doc._id.toString(),
      email: doc.email,
      password: doc.password,
      displayName: doc.displayName,
      anonymous: doc.anonymous,
      verified: doc.verified,
      ratings: doc.ratings,
      preferences: doc.preferences,
      isAdmin: doc.isAdmin || emailIsAdmin,
    };
  }

  async findById(id: string): Promise<IUser | null> {
    const user = await UserModel.findById(id).exec();
    if (!user) {
      return null;
    }
    return this.mapToEntity(user);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const user = await UserModel.findOne({ email }).exec();
    if (!user) {
      return null;
    }

    return this.mapToEntity(user);
  }

  async createWithEmailAndPassword(
    email: string,
    passwordHash: string,
    options?: UserCreateOptions,
  ): Promise<IUser> {
    const {
      password: _pw,
      verified: _v,
      ratings: _ratings,
      anonymous: _anon,
      email: _email,
      ...safeOptions
    } = options ?? {};
    const newUser = new UserModel({
      ...safeOptions,
      email,
      password: passwordHash,
      anonymous: false,
      verified: false,
    });
    let savedUser: IUserDocument;
    try {
      savedUser = await newUser.save();
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new Error("An account with this email already exists.");
      }
      throw error;
    }
    return this.mapToEntity(savedUser);
  }

  async createAnonymous(options?: UserCreateOptions): Promise<IUser> {
    const {
      password: _pw,
      verified: _v,
      ratings: _ratings,
      anonymous: _anon,
      email: _email,
      ...safeOptions
    } = options ?? {};
    const anonUser = new UserModel({
      ...safeOptions,
      anonymous: true,
      verified: false,
    });
    const savedUser = await anonUser.save();
    return this.mapToEntity(savedUser);
  }

  async updatePassword(
    email: string,
    newPasswordHash: string,
  ): Promise<boolean> {
    const result = await UserModel.updateOne(
      { email },
      { password: newPasswordHash },
    ).exec();
    return result.acknowledged && result.matchedCount > 0;
  }

  async verifyEmail(email: string): Promise<boolean> {
    const result = await UserModel.updateOne(
      { email },
      { verified: true },
    ).exec();
    return result.modifiedCount > 0;
  }

  async updateProfile(
    userId: string,
    update: UserProfileUpdate,
  ): Promise<IUser | null> {
    const setFields: UserProfileUpdate = {};

    if (update.displayName !== undefined) {
      setFields.displayName = update.displayName;
    }

    if (update.preferences !== undefined) {
      setFields.preferences = update.preferences;
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: setFields },
      { new: true, runValidators: true },
    ).exec();

    if (!user) {
      return null;
    }

    return this.mapToEntity(user);
  }

  async getRating(userId: string, mode: GameMode): Promise<number> {
    const user = await UserModel.findById(userId).exec();
    if (!user) {
      return 1000;
    }
    return user.ratings?.[mode] ?? 1000;
  }

  async updateRatings(
    updates: Array<{ userId: string; mode: GameMode; newRating: number }>,
  ): Promise<void> {
    const bulkOps = updates.map(({ userId, mode, newRating }) => ({
      updateOne: {
        filter: { _id: userId },
        update: { $set: { [`ratings.${mode}`]: newRating } },
      },
    }));

    await UserModel.bulkWrite(bulkOps);
  }
}
