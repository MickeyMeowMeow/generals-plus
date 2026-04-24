import type { Terrain as TerrainValue } from "@generals-plus/engine";
import { Terrain } from "@generals-plus/engine";

import cityIconUrl from "@/assets/generals-io/city.svg";
import crownIconUrl from "@/assets/generals-io/crown.svg";
import desertIconUrl from "@/assets/generals-io/desert.svg";
import mountainIconUrl from "@/assets/generals-io/mountain.svg";
import obstacleIconUrl from "@/assets/generals-io/obstacle.svg";
import swampIconUrl from "@/assets/generals-io/swamp.svg";

/**
 * Raster icons from generals.io used as the terrain overlay in the Pixi grid.
 */
const terrainIconUrls: Partial<Record<TerrainValue, string>> = {
  [Terrain.GENERAL]: crownIconUrl,
  [Terrain.MOUNTAIN]: mountainIconUrl,
  [Terrain.SWAMP]: swampIconUrl,
  [Terrain.DESERT]: desertIconUrl,
  [Terrain.CITY]: cityIconUrl,
  [Terrain.VOID]: obstacleIconUrl,
};

/**
 * Returns a terrain icon URL when the terrain has a visual marker.
 */
export function getTerrainIconUrl(terrain: TerrainValue): string | null {
  return terrainIconUrls[terrain] ?? null;
}
