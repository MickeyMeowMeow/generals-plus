import type { GameMode } from "@generals-plus/engine";
import type {
  CellTemplate,
  GridTemplate,
  SpawnPoint,
} from "@generals-plus/shared-types";
import type { Document } from "mongoose";
import mongoose, { Schema } from "mongoose";

export type { CellTemplate, GridTemplate, SpawnPoint };

export interface IMapDocument extends Document {
  name: string;
  description: string;
  authorId: string;
  authorName: string;
  grid: GridTemplate;
  supportedModes: GameMode[];
  minPlayers: number;
  maxPlayers: number;
  tags: string[];
  status: "draft" | "published";
  stats: {
    plays: number;
    likes: number;
  };
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
}

const CellTemplateSchema = new Schema<CellTemplate>(
  {
    terrain: { type: String, required: true },
    troopCount: { type: Number, default: null },
    siteIndex: { type: Number, default: null },
    zoneIndex: { type: Number, default: null },
  },
  { _id: false },
);

const SpawnPointSchema = new Schema<SpawnPoint>(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    teamId: { type: String, required: true },
    slot: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const CoordinateSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

const GridTemplateSchema = new Schema<GridTemplate>(
  {
    gridType: { type: String, required: true, enum: ["square", "hex"] },
    bounds: { type: Schema.Types.Mixed, required: true },
    cells: { type: [[CellTemplateSchema]], required: true },
    track: { type: [CoordinateSchema] },
    spawns: { type: [SpawnPointSchema], required: true },
  },
  { _id: false },
);

const MapSchema = new Schema<IMapDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    description: { type: String, default: "", maxlength: 1000 },
    authorId: { type: String, required: true, index: true },
    authorName: { type: String, required: true },
    grid: { type: GridTemplateSchema, required: true },
    supportedModes: { type: [String], required: true },
    minPlayers: { type: Number, required: true, min: 2 },
    maxPlayers: { type: Number, required: true, min: 2 },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    stats: {
      plays: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
    },
    thumbnail: { type: String, default: "" },
  },
  { timestamps: true },
);

MapSchema.index({ status: 1, "stats.plays": -1 });
MapSchema.index({ status: 1, "stats.likes": -1 });
MapSchema.index({ status: 1, updatedAt: -1 });

export const MapModel = mongoose.model<IMapDocument>("Map", MapSchema);
