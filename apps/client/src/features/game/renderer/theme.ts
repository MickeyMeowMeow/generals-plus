import type { VisionTerrain } from "@generals-plus/engine";
import { HiddenTerrain, MaskedTerrain, Terrain } from "@generals-plus/engine";
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
import { RenderConfig } from "#/features/game/renderer/render-config";

interface CellTheme {
  color: number;
  icon?: string;
}

export const NeutralTroopCellColor = 0x8aa4c8;

/**
 * Theme configuration for each terrain type, combining both color and icon information.
 */
export const TerrainTheme: Record<VisionTerrain, CellTheme> = {
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
  [Terrain.VOID]: {
    color: RenderConfig.background,
  },
  [MaskedTerrain.MAYBE_PLAIN]: {
    color: 0x525356,
  },
  [MaskedTerrain.MAYBE_MOUNTAIN]: {
    color: 0x525356,
    icon: obstacleIcon,
  },
  [HiddenTerrain]: {
    color: 0x525356,
  },
} as const;

export const TextStyleConfig: Record<string, Partial<TextStyle>> = {};
