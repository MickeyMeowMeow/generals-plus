import type { RoomUser } from "./room-user";

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
  players: RoomUser[];
  playerInit: PlayerInit[];
}
