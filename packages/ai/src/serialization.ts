/**
 * Serialization: engine vision grid → JSON for Python bot service.
 */

import type { IVisionCell } from "@generals-plus/engine";
import { Terrain } from "@generals-plus/engine";

import type { ScoreboardEntry, TickMessage, VisionCellJSON } from "./protocol";

export function serializeVisionCells(
  visionCells: IVisionCell[],
): VisionCellJSON[] {
  const result: VisionCellJSON[] = [];
  for (const vc of visionCells) {
    const terrain = vc.terrain as string;
    result.push({
      visibility: vc.visibility as string,
      terrain,
      troop_count: vc.troopCount ?? -1,
      owner_index: vc.owner?.status === "active" ? vc.owner.playerId : "",
      is_general: terrain === Terrain.GENERAL,
      is_city: terrain === Terrain.CITY,
    });
  }
  return result;
}

export interface GridInfo {
  type: "square" | "hex";
  width: number;
  height: number;
}

export function buildTickMessage(
  playerId: string,
  tick: number,
  grid: GridInfo,
  vision: VisionCellJSON[],
  ownedLandCount: number,
  ownedArmyCount: number,
  scoreboard: ScoreboardEntry[],
): TickMessage {
  return {
    type: "tick",
    player_id: playerId,
    tick,
    grid,
    vision,
    owned_land_count: ownedLandCount,
    owned_army_count: ownedArmyCount,
    scoreboard,
  };
}
