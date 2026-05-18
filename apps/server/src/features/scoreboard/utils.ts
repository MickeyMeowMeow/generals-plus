import type {
  GameMode as GameModeType,
  IBaseScoreboard,
  IClassicScoreboard,
  IDominationScoreboard,
  ITurfWarScoreboard,
} from "@generals-plus/engine";
import { GameMode } from "@generals-plus/engine";
import type {
  BaseScoreboard,
  BaseScoreboardPlayerEntry,
  PublicPlayer,
} from "@generals-plus/shared-types";
import {
  ClassicScoreboard,
  ClassicScoreboardPlayerEntry,
  DominationScoreboard,
  DominationScoreboardPlayerEntry,
  DominationScoreboardTeamEntry,
  TurfWarScoreboard,
  TurfWarScoreboardPlayerEntry,
  TurfWarScoreboardTeamEntry,
} from "@generals-plus/shared-types";

/**
 * Allocates the Colyseus scoreboard schema that matches the engine mode.
 *
 * The room state must use a concrete schema with the fields that mode can
 * publish; otherwise Colyseus cannot serialize mode-specific aggregates such as
 * Domination team scores or Turf War team territory.
 */
export function createScoreboard(mode: GameModeType): BaseScoreboard {
  let scoreboard: BaseScoreboard;
  switch (mode) {
    case GameMode.TURF_WAR:
      scoreboard = new TurfWarScoreboard();
      break;
    case GameMode.DOMINATION:
      scoreboard = new DominationScoreboard();
      break;
    default:
      scoreboard = new ClassicScoreboard();
      break;
  }
  scoreboard.mode = mode;
  return scoreboard;
}

/**
 * Copies an engine scoreboard into the room-state scoreboard schema.
 *
 * Engine scoreboards intentionally report game metrics only. During room-state
 * sync we enrich each row with public player metadata so the client HUD can
 * render names, colors, and team groups using only the scoreboard payload.
 */
export function syncScoreboard(
  target: BaseScoreboard,
  source: IBaseScoreboard,
  playerMetadata: Iterable<PublicPlayer> = [],
): void {
  target.mode = source.mode;
  const metadataByPlayer = new Map(
    Array.from(playerMetadata).map((player) => [player.id, player]),
  );

  switch (source.mode) {
    case GameMode.CLASSIC: {
      const classicTarget = target as ClassicScoreboard;
      const classicSource = source as IClassicScoreboard;
      syncPlayers(
        classicTarget,
        classicSource.players,
        metadataByPlayer,
        () => new ClassicScoreboardPlayerEntry(),
        (schema, entry) => {
          schema.troops = entry.troops;
          schema.land = entry.land;
          schema.isAlive = entry.isAlive;
        },
      );
      break;
    }
    case GameMode.TURF_WAR: {
      const turfTarget = target as TurfWarScoreboard;
      const turfSource = source as ITurfWarScoreboard;
      syncPlayers(
        turfTarget,
        turfSource.players,
        metadataByPlayer,
        () => new TurfWarScoreboardPlayerEntry(),
        (schema, entry) => {
          schema.troops = entry.troops;
          schema.land = entry.land;
          schema.isAlive = entry.isAlive;
        },
      );
      turfTarget.teams.clear();
      for (const entry of turfSource.teams) {
        const schema = new TurfWarScoreboardTeamEntry();
        schema.teamId = entry.teamId;
        schema.landPercent = entry.landPercent;
        schema.playerIds.push(...entry.playerIds);
        turfTarget.teams.push(schema);
      }
      break;
    }
    case GameMode.DOMINATION: {
      const domTarget = target as DominationScoreboard;
      const domSource = source as IDominationScoreboard;
      syncPlayers(
        domTarget,
        domSource.players,
        metadataByPlayer,
        () => new DominationScoreboardPlayerEntry(),
        (schema, entry) => {
          schema.troops = entry.troops;
          schema.land = entry.land;
          schema.isAlive = entry.isAlive;
        },
      );
      domTarget.teams.clear();
      const teamPlayers = new Map<string, string[]>();
      for (const entry of domSource.players) {
        const meta = metadataByPlayer.get(entry.playerId);
        const teamId = meta?.teamId ?? "";
        let ids = teamPlayers.get(teamId);
        if (!ids) {
          ids = [];
          teamPlayers.set(teamId, ids);
        }
        ids.push(entry.playerId);
      }
      for (const [teamId, score] of domSource.teamScores.entries()) {
        const schema = new DominationScoreboardTeamEntry();
        schema.teamId = teamId;
        schema.score = score;
        const ids = teamPlayers.get(teamId);
        if (ids) {
          schema.playerIds.push(...ids);
        }
        domTarget.teams.push(schema);
      }
      break;
    }
    default:
      syncPlayers(
        target as ClassicScoreboard,
        (source as IClassicScoreboard).players,
        metadataByPlayer,
        () => new ClassicScoreboardPlayerEntry(),
        (schema, entry) => {
          schema.troops = entry.troops;
          schema.land = entry.land;
          schema.isAlive = entry.isAlive;
        },
      );
      break;
  }
}

function syncPlayers<
  T extends BaseScoreboardPlayerEntry,
  E extends { readonly playerId: string },
>(
  target: { players: { clear(): void; push(item: T): void } },
  entries: readonly E[],
  metadataByPlayer: ReadonlyMap<string, PublicPlayer>,
  createEntry: () => T,
  configure?: (schema: T, entry: E) => void,
) {
  target.players.clear();
  for (const entry of entries) {
    const schema = createEntry();
    const metadata = metadataByPlayer.get(entry.playerId);
    schema.playerId = entry.playerId;
    schema.teamId = metadata?.teamId ?? "";
    schema.displayName = metadata?.displayName ?? entry.playerId;
    schema.color = metadata?.color ?? 0;
    configure?.(schema, entry);
    target.players.push(schema);
  }
}
