import { GameMode } from "@generals-plus/engine";

import { ClassicPlayer } from "#/schema/classic-player";
import { Player } from "#/schema/player";

export function createPlayer(mode: string): Player {
  switch (mode) {
    case GameMode.CLASSIC:
    case GameMode.TURF_WAR:
      return new ClassicPlayer();
    default:
      return new Player();
  }
}
