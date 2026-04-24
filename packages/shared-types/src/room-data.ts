import { z } from "zod";

export interface CellInit {
  terrain: string;
  isPassable: boolean;
  troopCount?: number;
  ownerIndex?: number;
}

export interface MapConfig {
  width: number;
  height: number;
  /** Flat array of CellInit, index = y * width + x */
  cells: CellInit[];
}

export interface PlayerInit {
  id: string;
  username: string;
  teamId: string;
}

export interface RoomData {
  mode: string;
  map: MapConfig;
  playerInit: PlayerInit[];
}

const cellInitSchema = z.object({
  terrain: z.string().min(1),
  isPassable: z.boolean(),
  troopCount: z.number().int().min(0).optional(),
  ownerIndex: z.number().int().min(-1).optional(),
});

const mapConfigSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    cells: z.array(cellInitSchema),
  })
  .refine((data) => data.cells.length === data.width * data.height, {
    message: "cells.length must equal width * height",
  });

const playerInitSchema = z.object({
  id: z.string().min(1),
  username: z.string().trim().min(1),
  teamId: z.string().min(1),
});

export const roomDataSchema = z
  .object({
    mode: z.string().min(1),
    map: mapConfigSchema,
    players: z.array(
      z.object({
        username: z.string().trim().min(1),
        token: z.string().min(1),
      }),
    ),
    playerInit: z.array(playerInitSchema),
  })
  .refine(
    (data) => {
      const playerUsernames = new Set(data.players.map((p) => p.username));
      const initUsernames = new Set(data.playerInit.map((p) => p.username));
      if (playerUsernames.size !== data.players.length) return false;
      if (initUsernames.size !== data.playerInit.length) return false;
      if (playerUsernames.size !== initUsernames.size) return false;
      for (const u of playerUsernames) {
        if (!initUsernames.has(u)) return false;
      }
      return true;
    },
    { message: "players and playerInit must have matching unique usernames" },
  );

export function parseRoomData(raw: unknown): RoomData | null {
  return roomDataSchema.safeParse(raw).success ? (raw as RoomData) : null;
}
