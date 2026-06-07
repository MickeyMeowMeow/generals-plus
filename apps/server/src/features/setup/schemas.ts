import { GameMode, GridType } from "@generals-plus/engine";
import * as z from "zod";

/** Schema for validating individual setup setting fields. */
export const setupSettingsUpdateSchema = z
  .object({
    gameMode: z.enum(GameMode).describe("Game mode"),
    maxPlayers: z.number().int().min(2).describe("Maximum player count"),
    isPublic: z.boolean().describe("Whether the room is publicly listed"),
    playersPerTeam: z.number().int().min(1).describe("Players per team"),
    mapType: z.enum(GridType).describe("Map grid type: square or hex"),
    mapSource: z
      .enum(["generated", "custom"])
      .describe("Map source: generated or custom"),
    customMapId: z
      .string()
      .describe("Custom map ID, used when mapSource is custom"),
    mapWidth: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("Square map width, from 5 to 100"),
    mapHeight: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("Square map height, from 5 to 100"),
    mapLeft: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("Left radius for a hex map"),
    mapRight: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("Right radius for a hex map"),
    mapLeftSlant: z
      .number()
      .int()
      .min(9)
      .max(199)
      .describe("Left slant radius for a hex map"),
    mapRightSlant: z
      .number()
      .int()
      .min(9)
      .max(199)
      .describe("Right slant radius for a hex map"),
    seed: z.number().int().describe("Random seed used for map generation"),
    mountainRate: z
      .number()
      .min(0)
      .max(1)
      .describe("Mountain density, from 0 to 1"),
    cityRate: z.number().min(0).max(1).describe("City density, from 0 to 1"),
    minGeneralDistanceFactor: z
      .number()
      .min(0)
      .max(1)
      .describe("Minimum general distance factor, from 0 to 1"),
    generalInitialTroops: z
      .number()
      .int()
      .min(1)
      .describe("Initial troop count for generals"),
    cityInitialTroops: z
      .number()
      .int()
      .min(0)
      .describe("Initial troop count for cities"),
    speed: z
      .number()
      .min(0.5)
      .max(10)
      .describe("Game speed multiplier, from 0.5 to 10"),
    duration: z.number().min(30).max(600).describe("Match duration in seconds"),
    flagCount: z
      .number()
      .int()
      .min(1)
      .max(20)
      .describe("Number of flags, used only in domination mode"),
    targetScore: z
      .number()
      .int()
      .min(100)
      .max(10000)
      .describe("Winning score, used only in domination mode"),
    bombSiteCount: z
      .number()
      .int()
      .min(1)
      .max(10)
      .describe("Number of bomb sites, used only in demolition mode"),
    plantDuration: z
      .number()
      .min(1)
      .max(30)
      .describe("Plant duration in seconds, used only in demolition mode"),
    defuseDuration: z
      .number()
      .min(1)
      .max(30)
      .describe("Defuse duration in seconds, used only in demolition mode"),
    detonateDuration: z
      .number()
      .min(10)
      .max(300)
      .describe(
        "Detonation countdown in seconds, used only in demolition mode",
      ),
    collapseInterval: z
      .number()
      .min(5)
      .max(300)
      .describe("Seconds between collapse waves, used only in collapse mode"),
    startDelay: z
      .number()
      .min(5)
      .max(600)
      .describe(
        "Delay before the first collapse in seconds, used only in collapse mode",
      ),
    collapseShape: z
      .enum(["circle", "square"])
      .describe("Collapse zone shape, used only in collapse mode"),
    payloadSpeed: z
      .number()
      .min(0.5)
      .max(10)
      .describe("Payload cart movement speed, used only in payload mode"),
    payloadCartSize: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("Payload cart size, used only in payload mode"),
    payloadRequiredOccupied: z
      .number()
      .int()
      .min(1)
      .max(25)
      .describe(
        "Number of occupied players required to move the payload, used only in payload mode",
      ),
    rugbyBallCount: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("Number of rugby balls, used only in rugby mode"),
    rugbyMoveSpeed: z
      .number()
      .min(0.2)
      .max(10)
      .describe("Rugby ball movement speed, used only in rugby mode"),
    rugbyWinningScore: z
      .number()
      .int()
      .min(1)
      .max(20)
      .describe("Winning score, used only in rugby mode"),
    incubationDuration: z
      .number()
      .min(15)
      .max(300)
      .describe("Incubation duration in seconds, used only in infection mode"),
    zombieTroopMultiplier: z
      .number()
      .min(1.5)
      .max(5)
      .describe("Zombie troop multiplier, used only in infection mode"),
  })
  .partial()
  .strict();

export type SetupSettingsUpdate = z.infer<typeof setupSettingsUpdateSchema>;
