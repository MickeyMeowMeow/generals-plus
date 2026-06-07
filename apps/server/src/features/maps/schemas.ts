import { GameMode, GridType, Terrain } from "@generals-plus/engine";
import * as z from "zod";

const TerrainSchema = z.enum(Terrain);

const CellTemplateSchema = z.object({
  terrain: TerrainSchema.describe("Terrain type of the cell"),
  troopCount: z
    .number()
    .nullable()
    .default(null)
    .describe("Initial troop count, null for non-city cells"),
  siteIndex: z
    .number()
    .int()
    .min(0)
    .nullable()
    .default(null)
    .describe("Site index for bomb sites or flags"),
  zoneIndex: z
    .number()
    .int()
    .min(0)
    .nullable()
    .default(null)
    .describe("Zone index for goal zones"),
});

const SpawnPointSchema = z.object({
  x: z.number().int().describe("X coordinate on the grid"),
  y: z.number().int().describe("Y coordinate on the grid"),
  teamId: z.string().min(1).describe("Team identifier for this spawn point"),
  slot: z.number().int().min(0).describe("Player slot index within the team"),
});

const CoordinateSchema = z.object({
  x: z.number().int().describe("X coordinate"),
  y: z.number().int().describe("Y coordinate"),
});

const SquareBoundsSchema = z.object({
  width: z.number().int().min(5).max(100).describe("Grid width, 5-100"),
  height: z.number().int().min(5).max(100).describe("Grid height, 5-100"),
});

const HexBoundsSchema = z.object({
  left: z.number().int().min(1).describe("Left radius"),
  right: z.number().int().min(1).describe("Right radius"),
  leftSlant: z.number().int().min(3).describe("Left slant radius"),
  rightSlant: z.number().int().min(3).describe("Right slant radius"),
});

const GridTemplateSchema = z.discriminatedUnion("gridType", [
  z.object({
    gridType: z.literal(GridType.SQUARE).describe("Square grid type"),
    bounds: SquareBoundsSchema.describe("Square grid dimensions"),
    cells: z
      .array(z.array(CellTemplateSchema))
      .describe("2D array of cell templates"),
    track: z
      .array(CoordinateSchema)
      .optional()
      .describe("Payload track waypoints"),
    spawns: z.array(SpawnPointSchema).describe("Spawn point definitions"),
  }),
  z.object({
    gridType: z.literal(GridType.HEX).describe("Hex grid type"),
    bounds: HexBoundsSchema.describe("Hex grid dimensions"),
    cells: z
      .array(z.array(CellTemplateSchema))
      .describe("2D array of cell templates"),
    track: z
      .array(CoordinateSchema)
      .optional()
      .describe("Payload track waypoints"),
    spawns: z.array(SpawnPointSchema).describe("Spawn point definitions"),
  }),
]);

export const createMapSchema = z.object({
  name: z.string().min(1).max(100).describe("Map name, 1-100 characters"),
  description: z
    .string()
    .max(1000)
    .optional()
    .describe("Map description, max 1000 characters"),
  grid: GridTemplateSchema.describe("Grid layout definition"),
  supportedModes: z
    .array(z.enum(GameMode))
    .min(1)
    .describe("Supported game modes, at least 1"),
  minPlayers: z.number().int().min(2).describe("Minimum player count"),
  maxPlayers: z.number().int().min(2).describe("Maximum player count"),
  tags: z.array(z.string()).optional().describe("Searchable tags"),
  status: z
    .enum(["draft", "published"])
    .optional()
    .describe("Publication status"),
  thumbnail: z.string().optional().describe("Thumbnail image URL"),
});

export const updateMapSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Map name, 1-100 characters"),
  description: z
    .string()
    .max(1000)
    .optional()
    .describe("Map description, max 1000 characters"),
  grid: GridTemplateSchema.optional().describe("Grid layout definition"),
  supportedModes: z
    .array(z.enum(GameMode))
    .min(1)
    .optional()
    .describe("Supported game modes, at least 1"),
  minPlayers: z
    .number()
    .int()
    .min(2)
    .optional()
    .describe("Minimum player count"),
  maxPlayers: z
    .number()
    .int()
    .min(2)
    .optional()
    .describe("Maximum player count"),
  tags: z.array(z.string()).optional().describe("Searchable tags"),
  status: z
    .enum(["draft", "published"])
    .optional()
    .describe("Publication status"),
  thumbnail: z.string().optional().describe("Thumbnail image URL"),
});

export type CreateMapInput = z.infer<typeof createMapSchema>;
export type UpdateMapInput = z.infer<typeof updateMapSchema>;

export const MapResponseSchema = z.object({
  id: z.string().describe("Map unique identifier"),
  name: z.string().describe("Map name"),
  description: z.string().describe("Map description"),
  authorId: z.string().describe("Author user ID"),
  authorName: z.string().describe("Author display name"),
  grid: GridTemplateSchema.describe("Grid layout definition"),
  supportedModes: z.array(z.enum(GameMode)).describe("Supported game modes"),
  minPlayers: z.number().describe("Minimum player count"),
  maxPlayers: z.number().describe("Maximum player count"),
  tags: z.array(z.string()).describe("Searchable tags"),
  status: z.enum(["draft", "published"]).describe("Publication status"),
  stats: z
    .object({
      plays: z.number().describe("Total play count"),
      likes: z.number().describe("Total like count"),
    })
    .describe("Map statistics"),
  thumbnail: z.string().describe("Thumbnail image URL"),
  createdAt: z.union([z.string(), z.date()]).describe("Creation timestamp"),
  updatedAt: z.union([z.string(), z.date()]).describe("Last update timestamp"),
});

export const MapListResponseSchema = z.object({
  maps: z
    .array(MapResponseSchema)
    .describe("Array of maps in the current page"),
  total: z.number().int().describe("Total number of published maps"),
});

export const ToggleLikeResponseSchema = z.object({
  result: z.enum(["liked", "unliked"]).describe("Result of the toggle action"),
});

export const MapQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number, starting from 1"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Items per page, max 50"),
  mode: z.enum(GameMode).optional().describe("Filter by game mode"),
  sort: z.enum(["plays", "likes", "date"]).optional().describe("Sort order"),
  search: z.string().optional().describe("Search term for map name or author"),
});

export const MapIdParamsSchema = z.object({
  id: z.string().describe("Map unique identifier"),
});
