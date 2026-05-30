import type {
  BackgroundImagePreference,
  UserPreferences,
} from "@generals-plus/shared-types";
import {
  BACKGROUND_PRESETS,
  DEFAULT_USER_PREFERENCES,
} from "@generals-plus/shared-types";
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
  preferences: UserPreferences;
}

const ratingField = { type: Number, default: 1000 };

const defaultUserPreferences = (): UserPreferences =>
  structuredClone(DEFAULT_USER_PREFERENCES);

const backgroundPresetIds = BACKGROUND_PRESETS.map((preset) => preset.id);
const backgroundSources = ["preset", "customUrl"] as const;

interface BackgroundImagePreferenceDocument {
  source: BackgroundImagePreference["source"];
  presetId?: string;
  customUrl?: string;
}

const isValidBackgroundImagePreference = (
  value: BackgroundImagePreferenceDocument | null | undefined,
) => {
  if (!value) {
    return false;
  }

  const hasPresetId = value.presetId !== undefined && value.presetId !== null;
  const hasCustomUrl =
    value.customUrl !== undefined && value.customUrl !== null;

  if (value.source === "preset") {
    return hasPresetId && !hasCustomUrl;
  }

  if (value.source === "customUrl") {
    return hasCustomUrl && !hasPresetId;
  }

  return false;
};

const BackgroundImagePreferenceSchema =
  new Schema<BackgroundImagePreferenceDocument>(
    {
      source: {
        type: String,
        enum: backgroundSources,
        required: true,
        default: DEFAULT_USER_PREFERENCES.backgroundImage.source,
      },
      presetId: {
        type: String,
        enum: backgroundPresetIds,
      },
      customUrl: { type: String },
    },
    { _id: false },
  );

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
    preferences: {
      type: {
        backgroundImage: {
          type: BackgroundImagePreferenceSchema,
          required: true,
          default: () =>
            structuredClone(DEFAULT_USER_PREFERENCES.backgroundImage),
          validate: {
            validator: isValidBackgroundImagePreference,
            message: "Invalid background image preference.",
          },
        },
      },
      default: defaultUserPreferences,
    },
  },
  {
    timestamps: true,
  },
);

export const UserModel = mongoose.model<IUserDocument>("User", UserSchema);
