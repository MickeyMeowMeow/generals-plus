import type { GameMode } from "@generals-plus/engine";
import { Terrain } from "@generals-plus/engine";
import type { MapConfig, MapGenerator } from "@generals-plus/shared-types";

export class DefaultMapGenerator implements MapGenerator {
  generate(_gameMode: GameMode, _playerCount: number): MapConfig {
    const width = 16;
    const height = 16;
    const cells = Array.from({ length: width * height }, (_, i) => {
      const x = i % width;
      const y = Math.floor(i / width);
      const isEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      return {
        terrain: isEdge ? Terrain.MOUNTAIN : Terrain.PLAIN,
        isPassable: !isEdge,
      };
    });
    return { width, height, cells };
  }
}
