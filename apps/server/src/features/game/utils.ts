import type { GridInput, IBaseGame } from "@generals-plus/engine";
import {
  ClassicGame,
  GameMode,
  Player,
  StandardTeam,
  TurfWarGame,
} from "@generals-plus/engine";

export interface CreateGameOptions {
  mode: GameMode;
  gridOptions?: GridInput;
  playerIds: string[];
  playerPerTeam: number;
}

/**
 * Factory function to create a game instance based on mode and options.
 * Each GameMode maps to a concrete IBaseGame implementation.
 *
 * @throws Error if the GameMode has no implementation yet.
 */
export function createGame(options: CreateGameOptions): IBaseGame {
  switch (options.mode) {
    case GameMode.CLASSIC: {
      const game = new ClassicGame(options.gridOptions ?? {});

      const teamsCount = Math.ceil(
        options.playerIds.length / options.playerPerTeam,
      );
      for (let i = 0; i < teamsCount; i++) {
        const teamId = `team_${i}`;
        const team = new StandardTeam(teamId);
        game.teams.set(teamId, team);
      }

      for (const [i, playerId] of options.playerIds.entries()) {
        const teamId = `team_${i % teamsCount}`;
        const team = game.teams.get(teamId);
        if (!team) {
          throw new Error(
            `Team with id "${teamId}" not found for player "${playerId}".`,
          );
        }

        const player = new Player(team, playerId);
        team.addPlayer(player);
        game.players.set(playerId, player);
      }

      return game;
    }
    case GameMode.TURF_WAR: {
      const game = new TurfWarGame(grid);

      const teamsCount = Math.ceil(
        options.playerIds.length / options.playerPerTeam,
      );
      for (let i = 0; i < teamsCount; i++) {
        const teamId = `team_${i}`;
        const team = new StandardTeam(teamId);
        game.teams.set(teamId, team);
      }

      for (const [i, playerId] of options.playerIds.entries()) {
        const teamId = `team_${i % teamsCount}`;
        const team = game.teams.get(teamId);
        if (!team) {
          throw new Error(
            `Team with id "${teamId}" not found for player "${playerId}".`,
          );
        }

        const player = new Player(team, playerId);
        team.addPlayer(player);
        game.players.set(playerId, player);
      }

      return game;
    }
    default:
      throw new Error(
        `[createGame] Game mode "${options.mode}" is not implemented yet.`,
      );
  }
}
