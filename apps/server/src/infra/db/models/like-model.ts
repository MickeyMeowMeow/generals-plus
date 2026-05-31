import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export interface ILikeDocument extends Document {
  mapId: string;
  userId: string;
}

const LikeSchema = new Schema<ILikeDocument>(
  {
    mapId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: true },
);

LikeSchema.index({ mapId: 1, userId: 1 }, { unique: true });

export const LikeModel = mongoose.model<ILikeDocument>("Like", LikeSchema);
