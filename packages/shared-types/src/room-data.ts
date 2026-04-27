import type { GameMode, IBaseGame } from "@generals-plus/engine";

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
  game: IBaseGame;
  playerInit: PlayerInit[];
  isPublic?: boolean;
}
