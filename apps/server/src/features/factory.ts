import type { GameMode as GameModeType } from "@generals-plus/engine";
import { GameMode } from "@generals-plus/engine";
import { ClassicPlayer, Player } from "@generals-plus/shared-types";

export function createPlayer(mode: GameModeType): Player {
  switch (mode) {
    case GameMode.CLASSIC:
      return new ClassicPlayer();
    default:
      return new Player();
  }
}
