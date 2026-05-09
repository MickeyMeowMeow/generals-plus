import { GameMode } from "@generals-plus/engine";
import type { RoomData } from "@generals-plus/shared-types";
import { z } from "zod";

const playerInitSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().min(1),
  teamId: z.string().min(1),
  color: z.number().int().positive(),
});

const roomDataSchema = z.object({
  mode: z.enum(Object.values(GameMode) as [GameMode, ...GameMode[]]),
  game: z
    .object({
      grid: z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
      startGame: z.function(),
      nextTick: z.function(),
      handleAction: z.function(),
      checkGameEnd: z.function(),
      getVisionGrid: z.function(),
      getPlayerStats: z.function(),
    })
    .loose(),
  playerInit: z.array(playerInitSchema),
  isPublic: z.boolean().optional(),
});

export function parseRoomData(raw: unknown): RoomData | null {
  if (!roomDataSchema.safeParse(raw).success) return null;
  return raw as RoomData;
}
