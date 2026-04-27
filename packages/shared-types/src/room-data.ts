import { GameMode, Terrain } from "@generals-plus/engine";
import { z } from "zod";

export interface CellInit {
  terrain: Terrain;
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

export interface ClientAuth {
  id: string;
  username: string;
}

export const ROOM_NAMES = {
  LOBBY: "lobby",
  QUEUE: "queue",
  SETUP: "setup",
  MATCH: "match",
} as const;

export interface RoomData {
  mode: GameMode;
  map: MapConfig;
  playerInit: PlayerInit[];
  isPublic?: boolean;
}

const terrainValues = Object.values(Terrain) as [Terrain, ...Terrain[]];
const gameModeValues = Object.values(GameMode) as [GameMode, ...GameMode[]];

const cellInitSchema = z.object({
  terrain: z.enum(terrainValues),
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
    mode: z.enum(gameModeValues),
    map: mapConfigSchema,
    playerInit: z.array(playerInitSchema),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const usernames = new Set(data.playerInit.map((p) => p.username));
      return usernames.size === data.playerInit.length;
    },
    { message: "playerInit must have unique usernames" },
  );

export function parseRoomData(raw: unknown): RoomData | null {
  const result = roomDataSchema.safeParse(raw);
  return result.success ? result.data : null;
}
