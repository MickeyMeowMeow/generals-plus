import { GameMode, GridType } from "@generals-plus/engine";
import * as z from "zod";

/** Schema for validating individual setup setting fields. */
export const setupSettingsUpdateSchema = z
  .object({
    gameMode: z.enum(GameMode).describe("Game mode"),
    maxPlayers: z.number().int().min(2).describe("Maximum number of players"),
    isPublic: z.boolean().describe("Whether the room is publicly listed"),
    playersPerTeam: z.number().int().min(1).describe("Players per team"),
    mapType: z.enum(GridType).describe("Grid type: square or hex"),
    mapSource: z
      .enum(["generated", "custom"])
      .describe("Map source: procedurally generated or custom"),
    customMapId: z
      .string()
      .describe("Custom map ID (used when mapSource is 'custom')"),
    mapWidth: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("Square grid width, 5-100"),
    mapHeight: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("Square grid height, 5-100"),
    mapLeft: z.number().int().min(5).max(100).describe("Hex grid left radius"),
    mapRight: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("Hex grid right radius"),
    mapLeftSlant: z
      .number()
      .int()
      .min(9)
      .max(199)
      .describe("Hex grid left slant radius"),
    mapRightSlant: z
      .number()
      .int()
      .min(9)
      .max(199)
      .describe("Hex grid right slant radius"),
    seed: z.number().int().describe("Random seed for map generation"),
    mountainRate: z.number().min(0).max(1).describe("Mountain density, 0-1"),
    cityRate: z.number().min(0).max(1).describe("City density, 0-1"),
    minGeneralDistanceFactor: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum general distance factor, 0-1"),
    generalInitialTroops: z
      .number()
      .int()
      .min(1)
      .describe("Initial troops on generals"),
    cityInitialTroops: z
      .number()
      .int()
      .min(0)
      .describe("Initial troops on cities"),
    speed: z
      .number()
      .min(0.5)
      .max(10)
      .describe("Game speed multiplier, 0.5-10"),
    duration: z.number().min(30).max(600).describe("Game duration in seconds"),
    flagCount: z
      .number()
      .int()
      .min(1)
      .max(20)
      .describe("Number of flags (Domination mode)"),
    targetScore: z
      .number()
      .int()
      .min(100)
      .max(10000)
      .describe("Score to win (Domination mode)"),
    bombSiteCount: z
      .number()
      .int()
      .min(1)
      .max(10)
      .describe("Number of bomb sites (Demolition mode)"),
    plantDuration: z
      .number()
      .min(1)
      .max(30)
      .describe("Plant duration in seconds (Demolition mode)"),
    defuseDuration: z
      .number()
      .min(1)
      .max(30)
      .describe("Defuse duration in seconds (Demolition mode)"),
    detonateDuration: z
      .number()
      .min(10)
      .max(300)
      .describe("Detonation countdown in seconds (Demolition mode)"),
    collapseInterval: z
      .number()
      .min(5)
      .max(300)
      .describe("Seconds between collapse waves (Collapse mode)"),
    startDelay: z
      .number()
      .min(5)
      .max(600)
      .describe("Seconds before first collapse (Collapse mode)"),
    collapseShape: z
      .enum(["circle", "square"])
      .describe("Collapse zone shape (Collapse mode)"),
    payloadSpeed: z
      .number()
      .min(0.5)
      .max(10)
      .describe("Payload cart speed (Payload mode)"),
    payloadCartSize: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("Payload cart size (Payload mode)"),
    payloadRequiredOccupied: z
      .number()
      .int()
      .min(1)
      .max(25)
      .describe("Required pushers for payload (Payload mode)"),
    rugbyBallCount: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("Number of rugby balls (Rugby mode)"),
    rugbyMoveSpeed: z
      .number()
      .min(0.2)
      .max(10)
      .describe("Rugby ball movement speed (Rugby mode)"),
    rugbyWinningScore: z
      .number()
      .int()
      .min(1)
      .max(20)
      .describe("Score to win (Rugby mode)"),
    incubationDuration: z
      .number()
      .min(15)
      .max(300)
      .describe("Incubation duration in seconds (Biohazard mode)"),
    zombieTroopMultiplier: z
      .number()
      .min(1.5)
      .max(5)
      .describe("Zombie troop multiplier (Biohazard mode)"),
  })
  .partial()
  .strict();

export type SetupSettingsUpdate = z.infer<typeof setupSettingsUpdateSchema>;
