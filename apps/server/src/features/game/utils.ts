import type {
  CollapseShape,
  GridInput,
  IBaseGame,
} from "@generals-plus/engine";
import {
  AttackerTeam,
  ClassicGame,
  CollapseGame,
  DefenderTeam,
  DemolitionGame,
  DominationGame,
  GameMode,
  GridType,
  PayloadGame,
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
  teamAssignments?: Record<string, string>;
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
  collapseShape?: CollapseShape;
}

interface PayloadCreateGameOptions extends BaseCreateGameOptions {
  mode: typeof GameMode.PAYLOAD;
  finishTick?: number;
  payloadSpeedTicks?: number;
  payloadCartSize?: number;
  payloadRequiredOccupied?: number;
}

interface OtherCreateGameOptions extends BaseCreateGameOptions {
  mode: Exclude<
    GameMode,
    | "classic"
    | "turf_war"
    | "domination"
    | "demolition"
    | "collapse"
    | "payload"
  >;
}

export type CreateGameOptions =
  | ClassicCreateGameOptions
  | TurfWarCreateGameOptions
  | DominationCreateGameOptions
  | DemolitionCreateGameOptions
  | CollapseCreateGameOptions
  | PayloadCreateGameOptions
  | OtherCreateGameOptions;

function getRoundRobinTeamAssignments(
  playerIds: string[],
  playerPerTeam: number,
) {
  const teamsCount = Math.ceil(playerIds.length / playerPerTeam);
  return playerIds.map(
    (playerId, i) => [playerId, `team_${i % teamsCount}`] as const,
  );
}

function getExplicitTeamAssignments({
  playerIds,
  playerPerTeam,
  teamAssignments,
}: BaseCreateGameOptions) {
  if (!teamAssignments) {
    return getRoundRobinTeamAssignments(playerIds, playerPerTeam);
  }

  return playerIds.map((playerId) => {
    const teamId = teamAssignments[playerId];
    if (!teamId) {
      throw new Error(`Missing team assignment for player "${playerId}".`);
    }
    return [playerId, teamId] as const;
  });
}

function getTeamAssignmentLookup(options: BaseCreateGameOptions) {
  return Object.fromEntries(getExplicitTeamAssignments(options));
}

function addStandardTeamsAndPlayers(
  game: IBaseGame,
  options: BaseCreateGameOptions,
) {
  const assignmentLookup = getTeamAssignmentLookup(options);
  const teamIds = Array.from(new Set(Object.values(assignmentLookup)));

  for (const teamId of teamIds) {
    const team = new StandardTeam(teamId);
    game.teams.set(teamId, team);
  }

  for (const playerId of options.playerIds) {
    const teamId = assignmentLookup[playerId];
    const team = teamId ? game.teams.get(teamId) : undefined;
    if (!team || !teamId) {
      throw new Error(
        `Team with id "${teamId}" not found for player "${playerId}".`,
      );
    }

    const player = new Player(team, playerId);
    team.addPlayer(player);
    game.players.set(playerId, player);
  }
}

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

      addStandardTeamsAndPlayers(game, options);
      return game;
    }
    case GameMode.CLASSIC: {
      const game = new ClassicGame({
        gridType: GridType.SQUARE,
        ...options.gridOptions,
        // Original generals.io: generals start with 1 troop (not 50)
        generalInitialTroops: 1,
      });

      addStandardTeamsAndPlayers(game, options);
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

      addStandardTeamsAndPlayers(game, options);
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

      addStandardTeamsAndPlayers(game, options);
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

      const assignmentLookup = options.teamAssignments
        ? getTeamAssignmentLookup(options)
        : null;

      for (const [i, playerId] of options.playerIds.entries()) {
        const teamId = assignmentLookup?.[playerId];
        const team = teamId
          ? game.teams.get(teamId)
          : i % 2 === 0
            ? attackers
            : defenders;
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
    case GameMode.PAYLOAD: {
      const game = new PayloadGame(
        {
          gridType: GridType.SQUARE,
          ...options.gridOptions,
          isPayload: true,
          payloadCartSize: options.payloadCartSize,
        },
        {
          finishTick: options.finishTick,
          payloadSpeedTicks: options.payloadSpeedTicks,
          payloadCartSize: options.payloadCartSize,
          payloadRequiredOccupied: options.payloadRequiredOccupied,
        },
      );

      addStandardTeamsAndPlayers(game, options);
      return game;
    }
    default:
      throw new Error(
        `[createGame] Game mode "${options.mode}" is not implemented yet.`,
      );
  }
}
