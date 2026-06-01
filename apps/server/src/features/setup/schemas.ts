import { GameMode, GridType } from "@generals-plus/engine";
import * as z from "zod";

/** Schema for validating individual setup setting fields. */
export const setupSettingsUpdateSchema = z
  .object({
    gameMode: z.enum(GameMode),
    maxPlayers: z.number().int().min(2),
    isPublic: z.boolean(),
    playersPerTeam: z.number().int().min(1),
    mapType: z.enum(GridType),
    mapSource: z.enum(["generated", "custom"]),
    customMapId: z.string(),
    mapWidth: z.number().int().min(5).max(100),
    mapHeight: z.number().int().min(5).max(100),
    mapLeft: z.number().int().min(5).max(100),
    mapRight: z.number().int().min(5).max(100),
    mapLeftSlant: z.number().int().min(9).max(199),
    mapRightSlant: z.number().int().min(9).max(199),
    seed: z.number().int(),
    mountainRate: z.number().min(0).max(1),
    cityRate: z.number().min(0).max(1),
    minGeneralDistanceFactor: z.number().min(0).max(1),
    generalInitialTroops: z.number().int().min(1),
    cityInitialTroops: z.number().int().min(0),
    speed: z.number().min(0.5).max(10),
    duration: z.number().min(30).max(600),
    flagCount: z.number().int().min(1).max(20),
    targetScore: z.number().int().min(100).max(10000),
    bombSiteCount: z.number().int().min(1).max(10),
    plantDuration: z.number().min(1).max(30),
    defuseDuration: z.number().min(1).max(30),
    detonateDuration: z.number().min(10).max(300),
    collapseInterval: z.number().min(5).max(300),
    startDelay: z.number().min(5).max(600),
    collapseShape: z.enum(["circle", "square"]),
    payloadSpeed: z.number().min(0.5).max(10),
    payloadCartSize: z.number().int().min(1).max(5),
    payloadRequiredOccupied: z.number().int().min(1).max(25),
    rugbyBallCount: z.number().int().min(1).max(5),
    rugbyMoveSpeed: z.number().min(0.2).max(10),
    rugbyWinningScore: z.number().int().min(1).max(20),
  })
  .partial()
  .strict();

export type SetupSettingsUpdate = z.infer<typeof setupSettingsUpdateSchema>;
