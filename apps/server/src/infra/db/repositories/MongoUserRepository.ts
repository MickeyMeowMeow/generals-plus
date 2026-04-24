import type {
  IUser,
  IUserRepository,
  UserCreateOptions,
} from "@/infra/db/interfaces";
import type { IUserDocument } from "@/infra/db/models/user-model";
import { UserModel } from "@/infra/db/models/user-model";

/**
 * MongoDB implementation of the IUserRepository using Mongoose.
 */
export class MongoUserRepository implements IUserRepository {
  /**
   * Map Mongoose Document to plain IUser entity.
   */
  private mapToEntity(doc: IUserDocument): IUser {
    return {
      id: doc._id.toString(),
      email: doc.email,
      password: doc.password,
      anonymous: doc.anonymous,
      verified: doc.verified,
      elo: doc.elo,
    };
  }

  public async findByEmail(email: string): Promise<IUser | null> {
    const user = await UserModel.findOne({ email }).exec();
    if (!user) {
      return null;
    }

    return this.mapToEntity(user);
  }

  public async createWithEmailAndPassword(
    email: string,
    passwordHash: string,
    options?: UserCreateOptions,
  ): Promise<IUser> {
    const newUser = new UserModel({
      email,
      password: passwordHash,
      anonymous: false,
      ...options,
    });
    const savedUser = await newUser.save();
    return this.mapToEntity(savedUser);
  }

  public async createAnonymous(options?: UserCreateOptions): Promise<IUser> {
    const anonUser = new UserModel({
      anonymous: true,
      ...options,
    });
    const savedUser = await anonUser.save();
    return this.mapToEntity(savedUser);
  }

  public async updatePassword(
    email: string,
    newPasswordHash: string,
  ): Promise<boolean> {
    const result = await UserModel.updateOne(
      { email },
      { password: newPasswordHash },
    ).exec();
    return result.modifiedCount > 0;
  }

  public async verifyEmail(email: string): Promise<boolean> {
    const result = await UserModel.updateOne(
      { email },
      { verified: true },
    ).exec();
    return result.modifiedCount > 0;
  }
}
