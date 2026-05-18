import type { GameMode } from "@generals-plus/engine";

interface BaseSetupSettings {
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
  speed: number;
}

export interface ClassicSetupSettings extends BaseSetupSettings {}

export interface TurfWarSetupSettings extends BaseSetupSettings {
  duration: number;
}

export type SetupSettings = ClassicSetupSettings | TurfWarSetupSettings;
