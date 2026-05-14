import type { GameMode } from "@generals-plus/engine";

export interface SetupSettings {
  gameMode: GameMode;
  isPublic: boolean;
  maxPlayers: number;
  playersPerTeam: number;
  mapWidth: number;
  mapHeight: number;
  seed: number;
  mountainRate: number;
  cityRate: number;
  minGeneralDistanceFactor: number;
  generalInitialTroops: number;
  cityInitialTroops: number;
}
