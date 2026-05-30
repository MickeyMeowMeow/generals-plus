import type { CollapseShape, GameMode, GridType } from "@generals-plus/engine";

interface BaseSetupSettings {
  gameMode: GameMode;
  isPublic: boolean;
  maxPlayers: number;
  playersPerTeam: number;
  mapType: GridType;
  mapWidth: number;
  mapHeight: number;
  mapLeft: number;
  mapRight: number;
  mapLeftSlant: number;
  mapRightSlant: number;
  seed: number;
  mountainRate: number;
  cityRate: number;
  minGeneralDistanceFactor: number;
  generalInitialTroops: number;
  cityInitialTroops: number;
  speed: number;
}

export interface ClassicSetupSettings extends BaseSetupSettings {
  gameMode: typeof GameMode.CLASSIC;
}

export interface TurfWarSetupSettings extends BaseSetupSettings {
  gameMode: typeof GameMode.TURF_WAR;
  duration: number;
}

export interface DominationSetupSettings extends BaseSetupSettings {
  gameMode: typeof GameMode.DOMINATION;
  duration: number;
  flagCount: number;
  targetScore: number;
}

export interface DemolitionSetupSettings extends BaseSetupSettings {
  gameMode: typeof GameMode.DEMOLITION;
  duration: number;
  bombSiteCount: number;
  plantDuration: number;
  defuseDuration: number;
  detonateDuration: number;
}

export interface CollapseSetupSettings extends BaseSetupSettings {
  gameMode: typeof GameMode.COLLAPSE;
  collapseInterval: number;
  startDelay: number;
  collapseShape: CollapseShape;
}

export interface OtherSettings extends BaseSetupSettings {
  gameMode: Exclude<
    GameMode,
    | typeof GameMode.CLASSIC
    | typeof GameMode.TURF_WAR
    | typeof GameMode.DOMINATION
    | typeof GameMode.DEMOLITION
    | typeof GameMode.COLLAPSE
  >;
}

export type SetupSettings =
  | ClassicSetupSettings
  | TurfWarSetupSettings
  | DominationSetupSettings
  | DemolitionSetupSettings
  | CollapseSetupSettings
  | OtherSettings;
