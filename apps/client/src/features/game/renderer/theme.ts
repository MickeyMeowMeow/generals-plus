import { Terrain } from "@generals-plus/engine";

import {
  cityIcon,
  crownIcon,
  desertIcon,
  mountainIcon,
  obstacleIcon,
  swampIcon,
} from "#/features/game/assets";

interface CellTheme {
  color: number;
  icon?: string;
}

/**
 * Theme configuration for each terrain type, combining both color and icon information.
 */
export const TerrainTheme: Record<Terrain, CellTheme> = {
  [Terrain.PLAIN]: {
    color: 0xd8dde3,
  },
  [Terrain.GENERAL]: {
    color: 0xf2b84b,
    icon: crownIcon,
  },
  [Terrain.MOUNTAIN]: {
    color: 0x4b5563,
    icon: mountainIcon,
  },
  [Terrain.SWAMP]: {
    color: 0x4f8a6f,
    icon: swampIcon,
  },
  [Terrain.DESERT]: {
    color: 0xe5cf8d,
    icon: desertIcon,
  },
  [Terrain.CITY]: {
    color: 0x8aa4c8,
    icon: cityIcon,
  },
  [Terrain.VOID]: {
    color: 0x171717,
    // FIX: This icon is not used for void terrain but for `VisionTerrain.MAYBE_MOUNTAIN` instead.
    icon: obstacleIcon,
  },
};
