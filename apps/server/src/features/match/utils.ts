import { GameMode } from "@generals-plus/engine";

export const BASE_TICK_INTERVAL = 500;

export interface ModeSettings {
  duration?: number;
  flagCount?: number;
  targetScore?: number;
}

export const MODE_SETTINGS: Partial<Record<GameMode, ModeSettings>> = {
  [GameMode.DOMINATION]: { duration: 300, flagCount: 3, targetScore: 1000 },
  [GameMode.TURF_WAR]: { duration: 180 },
};

export function calculateFinishTick(
  duration: number,
  tickInterval: number,
): number {
  return Math.round((duration * 1000) / tickInterval);
}
