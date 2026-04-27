import type { IBaseGame } from "@generals-plus/engine";
import { z } from "zod";

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
  mode: string;
  game: IBaseGame;
  playerInit: PlayerInit[];
  isPublic?: boolean;
}

const playerInitSchema = z.object({
  id: z.string().min(1),
  username: z.string().trim().min(1),
  teamId: z.string().min(1),
});

export const roomDataSchema = z.object({
  mode: z.string().min(1),
  game: z.any(),
  playerInit: z.array(playerInitSchema),
  isPublic: z.boolean().optional(),
});

export function parseRoomData(raw: unknown): RoomData | null {
  const result = roomDataSchema.safeParse(raw);
  return result.success ? result.data : null;
}
