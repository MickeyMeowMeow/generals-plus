import type { Terrain as TerrainValue } from "@generals-plus/engine";
import { Terrain } from "@generals-plus/engine";

/**
 * Central terrain palette for the base layer.
 */
const TerrainColors: Record<TerrainValue, number> = {
  [Terrain.PLAIN]: 0xd8dde3,
  [Terrain.GENERAL]: 0xf2b84b,
  [Terrain.MOUNTAIN]: 0x4b5563,
  [Terrain.SWAMP]: 0x4f8a6f,
  [Terrain.DESERT]: 0xe5cf8d,
  [Terrain.CITY]: 0x8aa4c8,
  [Terrain.VOID]: 0x171717,
} as const;

/**
 * Resolves a terrain enum value to a Pixi-compatible fill color.
 */
export function getTerrainColor(terrain: TerrainValue): number {
  return TerrainColors[terrain];
}
