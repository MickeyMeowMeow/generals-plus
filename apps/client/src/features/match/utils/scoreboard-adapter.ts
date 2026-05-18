import { GameMode } from "@generals-plus/engine";
import type { BaseScoreboard, Player } from "@generals-plus/shared-types";

/**
 * Column metadata used by the match HUD scoreboard table.
 */
export interface MatchHudColumn {
  /** Stable key used to read values from each row/group value map. */
  key: string;
  /** User-facing column label. */
  label: string;
}

/**
 * Render-ready player row for the match HUD scoreboard.
 */
export interface MatchHudRow {
  /** Stable player id. */
  id: string;
  /** Display name shown in the HUD. */
  label: string;
  /** Player color as a numeric RGB value. */
  color: number;
  /** Whether this row represents the current client. */
  isCurrent: boolean;
  /** Metric values keyed by {@link MatchHudColumn.key}. */
  values: Record<string, number | string>;
}

/**
 * Render-ready team or fallback player group for the match HUD scoreboard.
 */
export interface MatchHudGroup {
  /** Stable group id, usually a team id. */
  id: string;
  /** User-facing group label. */
  label: string;
  /** Optional aggregate values keyed by {@link MatchHudColumn.key}. */
  totals?: Record<string, number | string>;
  /** Player rows belonging to the group. */
  rows: MatchHudRow[];
}

/**
 * Mode-specific scoreboard data normalized for the match HUD renderer.
 */
export interface MatchHudScoreboardModel {
  /** Section title shown above the scoreboard rows. */
  title: string;
  /** Ordered metric columns to render. */
  columns: MatchHudColumn[];
  /** Ordered groups and rows to render. */
  groups: MatchHudGroup[];
}

interface TroopLandScoreEntry {
  playerId: string;
  teamId?: string;
  land: number;
  troops: number;
}

interface TeamScoreEntry {
  teamId: string;
  score: number;
}

type TeamScoresLike =
  | Iterable<[string, number]>
  | {
      forEach(callback: (score: number, teamId: string) => void): void;
    };

interface ScoreboardWithPlayers {
  players?: Iterable<TroopLandScoreEntry>;
}

interface ScoreboardWithTeamScores {
  teamScores?: TeamScoresLike;
}

interface CreateMatchHudScoreboardModelOptions {
  /** Raw Colyseus scoreboard schema received from match state. */
  scoreboard: BaseScoreboard;
  /** Player schemas visible to the current client. */
  visiblePlayers: Iterable<Player>;
  /** Fallback color lookup for players not present in visible state. */
  playerColors: Map<string, number>;
  /** Fallback display-name lookup for players not present in visible state. */
  playerNames: Map<string, string>;
  /** Current client's Colyseus session id, used to highlight its row. */
  currentSessionId: string | null | undefined;
}

const troopLandColumns: MatchHudColumn[] = [
  { key: "land", label: "Land" },
  { key: "troops", label: "Soldiers" },
];

const dominationColumns: MatchHudColumn[] = [
  { key: "score", label: "Score" },
  ...troopLandColumns,
];

/**
 * Extracts common troop and land entries from scoreboards that expose players.
 */
function getTroopLandEntries(scoreboard: BaseScoreboard) {
  const players = (scoreboard as ScoreboardWithPlayers | undefined)?.players;
  return players
    ? Array.from(players, (entry) => ({
        playerId: entry.playerId,
        teamId: entry.teamId,
        land: entry.land,
        troops: entry.troops,
      }))
    : [];
}

/**
 * Extracts team scores from either native iterables or Colyseus-style maps.
 */
function getTeamScoreEntries(scoreboard: BaseScoreboard): TeamScoreEntry[] {
  const teamScores = (scoreboard as ScoreboardWithTeamScores | undefined)
    ?.teamScores;
  if (!teamScores) return [];

  if (isIterableTeamScores(teamScores)) {
    return Array.from(teamScores, ([teamId, score]) => ({ teamId, score }));
  }

  const entries: TeamScoreEntry[] = [];
  teamScores.forEach((score, teamId) => {
    entries.push({ teamId, score });
  });
  return entries;
}

/**
 * Checks whether team scores can be consumed with `Array.from`.
 */
function isIterableTeamScores(
  teamScores: TeamScoresLike,
): teamScores is Iterable<[string, number]> {
  return Symbol.iterator in Object(teamScores);
}

/**
 * Merges scoreboard entries with visible player metadata into HUD rows.
 */
function createPlayerRows({
  scoreboard,
  visiblePlayers,
  playerColors,
  playerNames,
  currentSessionId,
}: CreateMatchHudScoreboardModelOptions): MatchHudRow[] {
  const scoreEntries = getTroopLandEntries(scoreboard);
  const scoreByPlayer = new Map(
    scoreEntries.map((entry) => [entry.playerId, entry]),
  );
  const playersById = new Map(
    Array.from(visiblePlayers).map((player) => [player.id, player]),
  );
  const playerIds = new Set([
    ...scoreEntries.map((entry) => entry.playerId),
    ...Array.from(playersById.keys()),
  ]);

  return Array.from(playerIds)
    .map((playerId) => {
      const player = playersById.get(playerId);
      const score = scoreByPlayer.get(playerId);
      return {
        id: playerId,
        label: player?.displayName || playerNames.get(playerId) || playerId,
        color: player?.color ?? playerColors.get(playerId) ?? 0,
        isCurrent: player?.sessionId === currentSessionId,
        values: {
          land: score?.land ?? 0,
          troops: score?.troops ?? 0,
        },
      };
    })
    .sort(
      (a, b) =>
        Number(b.values.troops) - Number(a.values.troops) ||
        a.label.localeCompare(b.label),
    );
}

/**
 * Groups player rows by team and computes troop/land totals for each group.
 */
function createTeamGroups(
  rows: MatchHudRow[],
  visiblePlayers: Iterable<Player>,
) {
  const teamByPlayer = new Map(
    Array.from(visiblePlayers).map((player) => [player.id, player.teamId]),
  );
  const groups = new Map<string, MatchHudGroup>();

  for (const row of rows) {
    const teamId = teamByPlayer.get(row.id) || row.id;
    const group = groups.get(teamId) ?? {
      id: teamId,
      label: teamByPlayer.get(row.id) ? `Team ${teamId}` : "Unassigned",
      totals: { land: 0, troops: 0 },
      rows: [],
    };

    group.totals = {
      land: Number(group.totals?.land ?? 0) + Number(row.values.land ?? 0),
      troops:
        Number(group.totals?.troops ?? 0) + Number(row.values.troops ?? 0),
    };
    group.rows.push(row);
    groups.set(teamId, group);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

/**
 * Creates a HUD model for modes whose scoreboard is based on land and soldiers.
 */
function createTroopLandModel(
  title: string,
  options: CreateMatchHudScoreboardModelOptions,
): MatchHudScoreboardModel {
  const rows = createPlayerRows(options);
  return {
    title,
    columns: troopLandColumns,
    groups: createTeamGroups(rows, options.visiblePlayers),
  };
}

/**
 * Creates a HUD model for Domination, adding team score as the leading metric.
 */
function createDominationModel(
  options: CreateMatchHudScoreboardModelOptions,
): MatchHudScoreboardModel {
  const rows = createPlayerRows(options);
  const scoreByTeam = new Map(
    getTeamScoreEntries(options.scoreboard).map((entry) => [
      entry.teamId,
      entry.score,
    ]),
  );
  const groups = createTeamGroups(rows, options.visiblePlayers).map((group) => {
    const score = scoreByTeam.get(group.id) ?? 0;
    return {
      ...group,
      totals: {
        score,
        land: group.totals?.land ?? 0,
        troops: group.totals?.troops ?? 0,
      },
      rows: group.rows.map((row) => ({
        ...row,
        values: { score: "", ...row.values },
      })),
    };
  });

  return {
    title: "Teams",
    columns: dominationColumns,
    groups: groups.sort(
      (a, b) =>
        Number(b.totals?.score ?? 0) - Number(a.totals?.score ?? 0) ||
        a.label.localeCompare(b.label),
    ),
  };
}

/**
 * Converts the mode-specific match scoreboard schema into a single HUD model.
 *
 * The adapter keeps mode branching outside of the React component so the HUD can
 * render a stable column/group/row shape for Classic, Turf War, Domination, and
 * future modes.
 */
export function createMatchHudScoreboardModel(
  options: CreateMatchHudScoreboardModelOptions,
): MatchHudScoreboardModel {
  switch (options.scoreboard.mode) {
    case GameMode.CLASSIC:
      return createTroopLandModel("Players", options);
    case GameMode.TURF_WAR:
      return createTroopLandModel("Players", options);
    case GameMode.DOMINATION:
      return createDominationModel(options);
    default:
      return createTroopLandModel("Players", options);
  }
}
