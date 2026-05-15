import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface IPlayerRatings {
  classic: number;
  demolition: number;
  turf_war: number;
  biohazard: number;
  payload: number;
  rugby: number;
  collapse: number;
  domination: number;
  espionage: number;
}

export interface IUserDocument extends Document {
  email?: string;
  password?: string;
  displayName?: string;
  anonymous: boolean;
  verified: boolean;
  ratings: IPlayerRatings;
}

const ratingField = { type: Number, default: 1000 };

const UserSchema = new Schema<IUserDocument>(
  {
    email: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String },
    displayName: { type: String, trim: true },
    anonymous: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    ratings: {
      classic: ratingField,
      demolition: ratingField,
      turf_war: ratingField,
      biohazard: ratingField,
      payload: ratingField,
      rugby: ratingField,
      collapse: ratingField,
      domination: ratingField,
      espionage: ratingField,
    },
  },
  {
    timestamps: true,
  },
);

export const UserModel = mongoose.model<IUserDocument>("User", UserSchema);
