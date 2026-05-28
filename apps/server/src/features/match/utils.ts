import { GameMode } from "@generals-plus/engine";

export const BASE_TICK_INTERVAL = 500;

export interface ModeSettings {
  duration?: number;
  flagCount?: number;
  targetScore?: number;
  bombSiteCount?: number;
  plantDuration?: number;
  defuseDuration?: number;
  detonateDuration?: number;
  collapseInterval?: number;
  startDelay?: number;
  collapseShape?: string;
}

export const MODE_SETTINGS: Partial<Record<GameMode, ModeSettings>> = {
  [GameMode.DOMINATION]: { duration: 300, flagCount: 3, targetScore: 1000 },
  [GameMode.TURF_WAR]: { duration: 180 },
  [GameMode.DEMOLITION]: {
    duration: 180,
    bombSiteCount: 2,
    plantDuration: 3,
    defuseDuration: 5,
    detonateDuration: 45,
  },
  [GameMode.COLLAPSE]: {
    startDelay: 60,
    collapseInterval: 30,
    collapseShape: "circle",
  },
};

export function calculateFinishTick(
  duration: number,
  tickInterval: number,
): number {
  return Math.round((duration * 1000) / tickInterval);
}
