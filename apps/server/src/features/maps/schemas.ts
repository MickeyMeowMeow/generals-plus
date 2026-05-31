import { GameMode, GridType, Terrain } from "@generals-plus/engine";
import * as z from "zod";

const TerrainSchema = z.enum(Terrain);

const CellTemplateSchema = z.object({
  terrain: TerrainSchema,
  troopCount: z.number().nullable().default(null),
  siteIndex: z.number().int().min(0).nullable().default(null),
});

const SpawnPointSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  teamId: z.string().min(1),
  slot: z.number().int().min(0),
});

const CoordinateSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

const SquareBoundsSchema = z.object({
  width: z.number().int().min(5).max(100),
  height: z.number().int().min(5).max(100),
});

const HexBoundsSchema = z.object({
  left: z.number().int().min(1),
  right: z.number().int().min(1),
  leftSlant: z.number().int().min(3),
  rightSlant: z.number().int().min(3),
});

const GridTemplateSchema = z.discriminatedUnion("gridType", [
  z.object({
    gridType: z.literal(GridType.SQUARE),
    bounds: SquareBoundsSchema,
    cells: z.array(z.array(CellTemplateSchema)),
    track: z.array(CoordinateSchema).optional(),
    spawns: z.array(SpawnPointSchema),
  }),
  z.object({
    gridType: z.literal(GridType.HEX),
    bounds: HexBoundsSchema,
    cells: z.array(z.array(CellTemplateSchema)),
    track: z.array(CoordinateSchema).optional(),
    spawns: z.array(SpawnPointSchema),
  }),
]);

export const createMapSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  grid: GridTemplateSchema,
  supportedModes: z.array(z.enum(GameMode)).min(1),
  minPlayers: z.number().int().min(2),
  maxPlayers: z.number().int().min(2),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "published"]).optional(),
  thumbnail: z.string().optional(),
});

export const updateMapSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  grid: GridTemplateSchema.optional(),
  supportedModes: z.array(z.enum(GameMode)).min(1).optional(),
  minPlayers: z.number().int().min(2).optional(),
  maxPlayers: z.number().int().min(2).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "published"]).optional(),
  thumbnail: z.string().optional(),
});

export type CreateMapInput = z.infer<typeof createMapSchema>;
export type UpdateMapInput = z.infer<typeof updateMapSchema>;
