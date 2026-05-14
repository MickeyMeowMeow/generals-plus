import type { IBaseGame } from "@generals-plus/engine";
import { GameMode } from "@generals-plus/engine";
import type {
  PlayerInit,
  QueuePlayer,
  SetupPlayer,
} from "@generals-plus/shared-types";
import { ClassicPlayer, Player } from "@generals-plus/shared-types";

export function createPlayerInit(
  players: SetupPlayer[] | QueuePlayer[],
  game: IBaseGame,
): PlayerInit[] {
  return players.map((setupPlayer) => {
    const gamePlayer = game.players.get(setupPlayer.id);
    if (!gamePlayer) {
      throw new Error(`Player with id ${setupPlayer.id} not found in game.`);
    }
    return {
      id: setupPlayer.id,
      displayName: setupPlayer.displayName,
      color: setupPlayer.color,
      teamId: gamePlayer.team.teamId,
    };
  });
}

export function createPlayer(mode: GameMode): Player {
  switch (mode) {
    case GameMode.CLASSIC:
      return new ClassicPlayer();
    default:
      return new Player();
  }
}
