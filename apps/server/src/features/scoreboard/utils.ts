import type {
  GameMode as GameModeType,
  IBaseScoreboard,
  IClassicScoreboard,
} from "@generals-plus/engine";
import { GameMode } from "@generals-plus/engine";
import {
  BaseScoreboard,
  ClassicScoreboard,
  ClassicScoreboardPlayerEntry,
} from "@generals-plus/shared-types";

export function createScoreboard(mode: GameModeType): BaseScoreboard {
  switch (mode) {
    case GameMode.CLASSIC:
      return new ClassicScoreboard();
    default:
      return new BaseScoreboard();
  }
}

export function syncScoreboard(
  target: BaseScoreboard,
  source: IBaseScoreboard,
): void {
  target.mode = source.mode;

  switch (source.mode) {
    case GameMode.CLASSIC: {
      const classicTarget = target as ClassicScoreboard;
      const classicSource = source as IClassicScoreboard;
      classicTarget.players.clear();
      for (const entry of classicSource.players) {
        const schema = new ClassicScoreboardPlayerEntry();
        schema.playerId = entry.playerId;
        schema.troops = entry.troops;
        schema.land = entry.land;
        schema.isGeneralAlive = entry.isGeneralAlive;
        classicTarget.players.push(schema);
      }
      break;
    }
  }
}
