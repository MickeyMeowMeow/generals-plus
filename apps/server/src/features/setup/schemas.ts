import { GameMode } from "@generals-plus/engine";
import { z } from "zod";

const MIN_MAP_DIM = 5;
const MAX_MAP_DIM = 100;

/** Schema for validating individual setup setting fields. */
export const setupSettingsUpdateSchema = z
  .object({
    gameMode: z.enum(GameMode),
    maxPlayers: z.number().int().min(2),
    isPublic: z.boolean(),
    playersPerTeam: z.number().int().min(1),
    mapWidth: z.number().int().min(MIN_MAP_DIM).max(MAX_MAP_DIM),
    mapHeight: z.number().int().min(MIN_MAP_DIM).max(MAX_MAP_DIM),
    seed: z.number().int(),
    mountainRate: z.number().min(0).max(1),
    cityRate: z.number().min(0).max(1),
    minGeneralDistanceFactor: z.number().min(0).max(1),
    generalInitialTroops: z.number().int().min(1),
    cityInitialTroops: z.number().int().min(0),
  })
  .partial()
  .strict();

export type SetupSettingsUpdate = z.infer<typeof setupSettingsUpdateSchema>;
