import type { VisionTerrain } from "@generals-plus/engine";
import { MaskedTerrain, Terrain } from "@generals-plus/engine";
import type { TextStyle } from "pixi.js";

import {
  cityIcon,
  crownIcon,
  desertIcon,
  flagIcon,
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
export const TerrainTheme: Partial<
  Record<NonNullable<VisionTerrain>, CellTheme>
> = {
  [Terrain.PLAIN]: {
    color: 0xd8dde3,
  },
  [Terrain.GENERAL]: {
    color: 0xf2b84b,
    icon: crownIcon,
  },
  [Terrain.MOUNTAIN]: {
    color: 0x9da8b6,
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
  [Terrain.FLAG]: {
    color: 0x8aa4c8,
    icon: flagIcon,
  },
  [Terrain.BOMB_SITE]: {
    color: 0x8aa4c8,
  },
  [MaskedTerrain.MAYBE_PLAIN]: {
    color: 0xd8dde3,
  },
  [MaskedTerrain.MAYBE_MOUNTAIN]: {
    color: 0xd8dde3,
    icon: obstacleIcon,
  },
};

export const TextStyleConfig: Record<string, Partial<TextStyle>> = {};
