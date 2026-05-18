import type { GameMode, IBaseGame } from "@generals-plus/engine";

import type { PlayerRatings } from "#/player-ratings";

export interface PlayerInit {
  id: string;
  displayName: string;
  teamId: string;
  color: number;
}

export interface ClientAuth {
  id: string;
  displayName: string;
  ratings?: PlayerRatings;
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
  tickInterval?: number;
  finishTick?: number;
  targetScore?: number;
}
