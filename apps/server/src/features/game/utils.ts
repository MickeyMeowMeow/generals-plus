import type { GridInput, IBaseGame } from "@generals-plus/engine";
import {
  AttackerTeam,
  ClassicGame,
  CollapseGame,
  DefenderTeam,
  DemolitionGame,
  DominationGame,
  GameMode,
  GridType,
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

interface DemolitionCreateGameOptions extends BaseCreateGameOptions {
  mode: typeof GameMode.DEMOLITION;
  finishTick?: number;
  plantDurationTicks?: number;
  defuseDurationTicks?: number;
  detonateDurationTicks?: number;
  bombSiteCount?: number;
  seed?: number;
}

interface CollapseCreateGameOptions extends BaseCreateGameOptions {
  mode: typeof GameMode.COLLAPSE;
  startDelayTicks?: number;
  shrinkIntervalTicks?: number;
  collapseShape?: "circle" | "square";
}

interface OtherCreateGameOptions extends BaseCreateGameOptions {
  mode: Exclude<
    GameMode,
    "classic" | "turf_war" | "domination" | "demolition" | "collapse"
  >;
}

export type CreateGameOptions =
  | ClassicCreateGameOptions
  | TurfWarCreateGameOptions
  | DominationCreateGameOptions
  | DemolitionCreateGameOptions
  | CollapseCreateGameOptions
  | OtherCreateGameOptions;

/**
 * Factory function to create a game instance based on mode and options.
 * Each GameMode maps to a concrete IBaseGame implementation.
 *
 * @throws Error if the GameMode has no implementation yet.
 */
export function createGame(options: CreateGameOptions): IBaseGame {
  switch (options.mode) {
    case GameMode.COLLAPSE: {
      const game = new CollapseGame(
        {
          gridType: GridType.SQUARE,
          ...options.gridOptions,
        },
        {
          startDelayTicks: options.startDelayTicks,
          shrinkIntervalTicks: options.shrinkIntervalTicks,
          collapseShape: options.collapseShape,
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
    case GameMode.CLASSIC: {
      const game = new ClassicGame({
        gridType: GridType.SQUARE,
        ...options.gridOptions,
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
    case GameMode.TURF_WAR: {
      const game = new TurfWarGame(
        {
          gridType: GridType.SQUARE,
          ...options.gridOptions,
        },
        {
          finishTick: options.finishTick,
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
    case GameMode.DOMINATION: {
      const game = new DominationGame(
        {
          gridType: GridType.SQUARE,
          ...options.gridOptions,
        },
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
    case GameMode.DEMOLITION: {
      const game = new DemolitionGame(
        {
          gridType: GridType.SQUARE,
          ...options.gridOptions,
        },
        {
          finishTick: options.finishTick,
          plantDurationTicks: options.plantDurationTicks,
          defuseDurationTicks: options.defuseDurationTicks,
          detonateDurationTicks: options.detonateDurationTicks,
          bombSiteCount: options.bombSiteCount,
          seed: options.seed,
        },
      );

      const attackers = new AttackerTeam("attackers");
      const defenders = new DefenderTeam("defenders");
      game.teams.set("attackers", attackers);
      game.teams.set("defenders", defenders);

      // Partition playerIds half and half into Attackers and Defenders
      for (const [i, playerId] of options.playerIds.entries()) {
        const team = i % 2 === 0 ? attackers : defenders;
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
