import { GameMode } from "@generals-plus/engine";
import type { BaseScoreboard } from "@generals-plus/shared-types";

/**
 * Column metadata used by the match HUD scoreboard table.
 */
export interface GameHudColumn {
  /** Stable key used to read values from each row/group value map. */
  key: string;
  /** User-facing column label. */
  label: string;
}

/**
 * Render-ready player row for the match HUD scoreboard.
 */
export interface GameHudRow {
  /** Stable player id. */
  id: string;
  /** Team id used for grouping when known. */
  teamId?: string;
  /** Display name shown in the HUD. */
  label: string;
  /** Player color as a numeric RGB value. */
  color: number;
  /** Metric values keyed by {@link GameHudColumn.key}. */
  values: Record<string, number | string>;
}

/**
 * Render-ready team or fallback player group for the match HUD scoreboard.
 */
export interface GameHudGroup {
  /** Stable group id, usually a team id. */
  id: string;
  /** User-facing group label. */
  label: string;
  /** Optional aggregate values keyed by {@link GameHudColumn.key}. */
  totals?: Record<string, number | string>;
  /** Player rows belonging to the group. */
  rows: GameHudRow[];
}

/**
 * Mode-specific scoreboard data normalized for the match HUD renderer.
 */
export interface GameHudScoreboardModel {
  /** Section title shown above the scoreboard rows. */
  title: string;
  /** Optional secondary subtitle or target displayed on the right. */
  subtitle?: string;
  /** Ordered metric columns to render. */
  columns: GameHudColumn[];
  /** Ordered groups and rows to render. */
  groups: GameHudGroup[];
  /** Whether the mode uses teams grouping. */
  hasTeams: boolean;
}

interface TroopLandScoreEntry {
  playerId: string;
  teamId?: string;
  displayName?: string;
  color?: number;
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

interface TurfWarTeamEntryLike {
  teamId: string;
  landPercent: number;
}

interface ScoreboardWithTurfWarTeams {
  teams?: Iterable<TurfWarTeamEntryLike>;
}

interface DominationTeamEntryLike {
  teamId: string;
  score: number;
}

interface ScoreboardWithDominationTeams {
  teams?: Iterable<DominationTeamEntryLike>;
}

const troopLandColumns: GameHudColumn[] = [
  { key: "land", label: "Land" },
  { key: "troops", label: "Soldiers" },
];

const turfWarColumns: GameHudColumn[] = [
  { key: "percent", label: "Area" },
  { key: "land", label: "Land" },
  { key: "troops", label: "Soldiers" },
];

const dominationColumns: GameHudColumn[] = [
  { key: "score", label: "Score" },
  { key: "land", label: "Land" },
  { key: "troops", label: "Soldiers" },
];

/**
 * Extracts common troop and land entries from scoreboards that expose players.
 *
 * Scoreboard rows are expected to already contain public display metadata; the
 * HUD adapter does not reach into match player maps for names, colors, or teams.
 */
function getTroopLandEntries(scoreboard: BaseScoreboard) {
  const players = (scoreboard as ScoreboardWithPlayers | undefined)?.players;
  return players
    ? Array.from(players, (entry) => ({
        playerId: entry.playerId,
        teamId: entry.teamId,
        displayName: entry.displayName,
        color: entry.color,
        land: entry.land,
        troops: entry.troops,
      }))
    : [];
}

/**
 * Extracts team scores from either native iterables or Colyseus-style maps.
 */
export function getTeamScoreEntries(
  scoreboard: BaseScoreboard,
): TeamScoreEntry[] {
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

function getTurfWarTeamEntries(
  scoreboard: BaseScoreboard,
): TurfWarTeamEntryLike[] {
  const teams = (scoreboard as ScoreboardWithTurfWarTeams | undefined)?.teams;
  return teams ? Array.from(teams) : [];
}

function getDominationTeamEntries(
  scoreboard: BaseScoreboard,
): DominationTeamEntryLike[] {
  const teams = (scoreboard as ScoreboardWithDominationTeams | undefined)
    ?.teams;
  return teams ? Array.from(teams) : [];
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
 * Converts scoreboard player entries into HUD rows.
 *
 * Keeping this conversion scoreboard-only makes the HUD independent from
 * view-scoped Colyseus player state, which may contain only the local player.
 */
function createPlayerRows(scoreboard: BaseScoreboard): GameHudRow[] {
  const scoreEntries = getTroopLandEntries(scoreboard);
  return scoreEntries
    .map((score) => {
      return {
        id: score.playerId,
        teamId: score.teamId,
        label: score.displayName || score.playerId,
        color: score.color ?? 0,
        values: {
          land: score.land,
          troops: score.troops,
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
function createTeamGroups(rows: GameHudRow[]) {
  const groups = new Map<string, GameHudGroup>();

  for (const row of rows) {
    const teamId = row.teamId || row.id;
    const group = groups.get(teamId) ?? {
      id: teamId,
      label: row.teamId ? `Team ${teamId}` : "Unassigned",
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
  scoreboard: BaseScoreboard,
): GameHudScoreboardModel {
  const rows = createPlayerRows(scoreboard);
  return {
    title,
    columns: troopLandColumns,
    groups: createTeamGroups(rows).sort(
      (a, b) =>
        Number(b.totals?.troops ?? 0) - Number(a.totals?.troops ?? 0) ||
        a.label.localeCompare(b.label),
    ),
    hasTeams: false,
  };
}

/**
 * Creates a HUD model for Turf War, showing team land percentages in team labels.
 */
function createTurfWarModel(
  scoreboard: BaseScoreboard,
): GameHudScoreboardModel {
  const rows = createPlayerRows(scoreboard);
  const landPercentByTeam = new Map(
    getTurfWarTeamEntries(scoreboard).map((entry) => [
      entry.teamId,
      entry.landPercent,
    ]),
  );

  const groups = createTeamGroups(rows).map((group) => {
    const percent = landPercentByTeam.get(group.id) ?? 0;
    return {
      ...group,
      label: group.label,
      totals: {
        ...group.totals,
        percent: `${percent}%`,
      },
    };
  });

  return {
    title: "Turf War",
    columns: turfWarColumns,
    groups: groups.sort(
      (a, b) =>
        (landPercentByTeam.get(b.id) ?? 0) -
          (landPercentByTeam.get(a.id) ?? 0) || a.label.localeCompare(b.label),
    ),
    hasTeams: true,
  };
}

function createDominationModel(
  scoreboard: BaseScoreboard,
  targetScore?: number,
): GameHudScoreboardModel {
  const rows = createPlayerRows(scoreboard);
  const scoreByTeam = new Map(
    getDominationTeamEntries(scoreboard).map((entry) => [
      entry.teamId,
      entry.score,
    ]),
  );

  const finalTarget = targetScore && targetScore > 0 ? targetScore : 1000;

  const groups = createTeamGroups(rows).map((group) => {
    const score = scoreByTeam.get(group.id) ?? 0;
    return {
      ...group,
      label: group.label,
      totals: {
        ...group.totals,
        score: `${score}/${finalTarget}`,
      },
    };
  });

  return {
    title: "Domination",
    subtitle: `Target: ${finalTarget}`,
    columns: dominationColumns,
    groups: groups.sort(
      (a, b) =>
        (scoreByTeam.get(b.id) ?? 0) - (scoreByTeam.get(a.id) ?? 0) ||
        a.label.localeCompare(b.label),
    ),
    hasTeams: true,
  };
}

/**
 * Converts the mode-specific match scoreboard schema into a single HUD model.
 *
 * The adapter keeps mode branching outside of the React component so the HUD can
 * render a stable column/group/row shape for Classic, Turf War, and future modes.
 */
export function createGameHudScoreboardModel(
  scoreboard: BaseScoreboard,
  targetScore?: number,
): GameHudScoreboardModel {
  switch (scoreboard.mode) {
    case GameMode.CLASSIC:
      return createTroopLandModel("Classic", scoreboard);
    case GameMode.TURF_WAR:
      return createTurfWarModel(scoreboard);
    case GameMode.DOMINATION:
      return createDominationModel(scoreboard, targetScore);
    default:
      return createTroopLandModel("Classic", scoreboard);
  }
}
