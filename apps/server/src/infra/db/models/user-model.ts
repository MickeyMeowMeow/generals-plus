import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface IUserDocument extends Document {
  email?: string;
  password?: string;
  username?: string;
  anonymous: boolean;
  verified: boolean;
  elo: number;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String }, // Stores hashed password from @colyseus/auth
    username: { type: String, trim: true },
    anonymous: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    elo: { type: Number, default: 1000 },
  },
  {
    timestamps: true,
  },
);

export const UserModel = mongoose.model<IUserDocument>("User", UserSchema);
