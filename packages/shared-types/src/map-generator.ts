import type { GameMode } from "@generals-plus/engine";

import type { MapConfig } from "#/room-data";

export interface MapGenerator {
  generate(gameMode: GameMode, playerCount: number): MapConfig;
}
