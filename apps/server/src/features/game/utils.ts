import type {
  DominationGridOptions,
  GridInput,
  IBaseGame,
} from "@generals-plus/engine";
import {
  ClassicGame,
  DominationGame,
  GameMode,
  Player,
  StandardTeam,
  TurfWarGame,
} from "@generals-plus/engine";

/** Generate a random 32-bit seed from current time and Math.random(). */
export function generateSeed(): number {
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
}

export interface BaseCreateGameOptions {
  mode: GameMode;
  gridOptions?: GridInput;
  playerIds: string[];
  playerPerTeam: number;
}

interface ClassicCreateGameOptions extends BaseCreateGameOptions {
  mode: typeof GameMode.CLASSIC;
}

interface TurfWarCreateGameOptions extends BaseCreateGameOptions {
  mode: typeof GameMode.TURF_WAR;
  finishTick?: number;
}

interface DominationCreateGameOptions extends BaseCreateGameOptions {
  mode: typeof GameMode.DOMINATION;
  finishTick?: number;
  targetScore?: number;
}

interface OtherCreateGameOptions extends BaseCreateGameOptions {
  mode: Exclude<GameMode, "classic" | "turf_war" | "domination">;
}

export type CreateGameOptions =
  | ClassicCreateGameOptions
  | TurfWarCreateGameOptions
  | DominationCreateGameOptions
  | OtherCreateGameOptions;

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
      const game = new TurfWarGame(options.gridOptions ?? {}, {
        finishTick: options.finishTick,
      });

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
    case GameMode.DOMINATION: {
      const game = new DominationGame(
        (options.gridOptions ?? {}) as DominationGridOptions,
        {
          finishTick: options.finishTick,
          targetScore: options.targetScore,
        },
      );

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
