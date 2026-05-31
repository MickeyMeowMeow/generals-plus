import { logger } from "@colyseus/core";
import { GameMode, GridType } from "@generals-plus/engine";
import type { RoomData } from "@generals-plus/shared-types";
import * as z from "zod";

const playerInitSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().min(1),
  teamId: z.string().min(1),
  color: z.number().int().positive(),
  isBot: z.boolean().optional(),
});

const roomDataSchema = z.object({
  mode: z.enum(GameMode),
  game: z
    .object({
      grid: z.object({
        gridType: z.enum(GridType),
      }),
      startGame: z.function(),
      nextTick: z.function(),
      handleAction: z.function(),
      checkGameEnd: z.function(),
      getVisionGrid: z.function(),
      getPlayerState: z.function(),
      getScoreboard: z.function(),
    })
    .loose(),
  playerInit: z.array(playerInitSchema),
  isPublic: z.boolean().optional(),
});

export function parseRoomData(raw: unknown): RoomData | null {
  const result = roomDataSchema.safeParse(raw);
  if (!result.success) {
    logger.error(
      `[parseRoomData] Validation failed: ${JSON.stringify(result.error.issues)}`,
    );
    return null;
  }
  return raw as RoomData;
}
