import type { GameMode } from "@generals-plus/engine";

import type {
  IUser,
  IUserRepository,
  UserCreateOptions,
} from "#/infra/db/interfaces";
import type { IUserDocument } from "#/infra/db/models/user-model";
import { UserModel } from "#/infra/db/models/user-model";

/**
 * MongoDB implementation of the IUserRepository using Mongoose.
 */
export class MongoUserRepository implements IUserRepository {
  private mapToEntity(doc: IUserDocument): IUser {
    return {
      id: doc._id.toString(),
      email: doc.email,
      password: doc.password,
      displayName: doc.displayName,
      anonymous: doc.anonymous,
      verified: doc.verified,
      ratings: doc.ratings,
    };
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
    const savedUser = await newUser.save();
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
