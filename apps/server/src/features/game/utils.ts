import type { GridGeneratorOptions, IBaseGame } from "@generals-plus/engine";
import {
  DefaultGridGenerator,
  GameMode,
  Player,
  StandardGame,
  StandardTeam,
} from "@generals-plus/engine";

export interface CreateGameOptions {
  mode: GameMode;
  gridOptions?: GridGeneratorOptions;
  playerIds: string[];
}

/**
 * Factory function to create a game instance based on mode and options.
 * Each GameMode maps to a concrete IBaseGame implementation.
 *
 * @throws Error if the GameMode has no implementation yet.
 */
export function createGame(options: CreateGameOptions): IBaseGame {
  const grid = new DefaultGridGenerator().generate(options.gridOptions);

  switch (options.mode) {
    case GameMode.CLASSIC: {
      const game = new StandardGame(grid);

      for (let i = 0; i < options.playerIds.length; i++) {
        const playerId = options.playerIds[i];
        const teamId = `team_${i}`;

        const team = new StandardTeam(teamId);
        const player = new Player(team, playerId);

        team.addPlayer(player);
        game.players.set(playerId, player);
        game.teams.set(teamId, team);
      }

      return game;
    }
    default:
      throw new Error(
        `[createGame] Game mode "${options.mode}" is not implemented yet.`,
      );
  }
}
