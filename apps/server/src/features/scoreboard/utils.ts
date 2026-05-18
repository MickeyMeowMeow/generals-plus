import type {
  GameMode as GameModeType,
  IBaseScoreboard,
  IClassicScoreboard,
  IDominationScoreboard,
  ITurfWarScoreboard,
} from "@generals-plus/engine";
import { GameMode } from "@generals-plus/engine";
import type { BaseScoreboard } from "@generals-plus/shared-types";
import {
  ClassicScoreboard,
  ClassicScoreboardPlayerEntry,
  DominationScoreboard,
  TroopLandScoreboard,
  TroopLandScoreboardPlayerEntry,
  TurfWarScoreboard,
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
    case GameMode.CLASSIC:
      scoreboard = new ClassicScoreboard();
      break;
    case GameMode.TURF_WAR:
      scoreboard = new TurfWarScoreboard();
      break;
    case GameMode.DOMINATION:
      scoreboard = new DominationScoreboard();
      break;
    default:
      scoreboard = new TroopLandScoreboard();
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
  playerMetadata: Iterable<PlayerScoreboardMetadata> = [],
): void {
  target.mode = source.mode;
  const metadataByPlayer = new Map(
    Array.from(playerMetadata).map((player) => [player.id, player]),
  );

  switch (source.mode) {
    case GameMode.CLASSIC: {
      const classicTarget = target as ClassicScoreboard;
      const classicSource = source as IClassicScoreboard;
      classicTarget.players.clear();
      for (const entry of classicSource.players) {
        const schema = new ClassicScoreboardPlayerEntry();
        syncBasePlayerFields(schema, entry, metadataByPlayer);
        schema.troops = entry.troops;
        schema.land = entry.land;
        schema.isAlive = entry.isAlive;
        classicTarget.players.push(schema);
      }
      break;
    }
    case GameMode.TURF_WAR: {
      const turfTarget = target as TurfWarScoreboard;
      const turfSource = source as ITurfWarScoreboard;
      syncTroopLandPlayers(turfTarget, turfSource.players, metadataByPlayer);
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
      const dominationTarget = target as DominationScoreboard;
      const dominationSource = source as IDominationScoreboard;
      syncTroopLandPlayers(
        dominationTarget,
        dominationSource.players,
        metadataByPlayer,
      );
      dominationTarget.teamScores.clear();
      for (const [teamId, score] of dominationSource.teamScores) {
        dominationTarget.teamScores.set(teamId, score);
      }
      break;
    }
    default: {
      const players = (source as { players?: TroopLandScoreEntry[] }).players;
      if (players) {
        syncTroopLandPlayers(
          target as TroopLandScoreboard,
          players,
          metadataByPlayer,
        );
      }
      break;
    }
  }
}

type TroopLandScoreEntry = {
  readonly playerId: string;
  readonly troops: number;
  readonly land: number;
  readonly teamId?: string;
};

type PlayerScoreboardMetadata = {
  readonly id: string;
  readonly teamId: string;
  readonly displayName: string;
  readonly color: number;
};

/**
 * Replaces troop/land rows while preserving a scoreboard-only HUD contract.
 */
function syncTroopLandPlayers(
  target: TroopLandScoreboard,
  entries: readonly TroopLandScoreEntry[],
  metadataByPlayer: ReadonlyMap<string, PlayerScoreboardMetadata>,
) {
  target.players.clear();
  for (const entry of entries) {
    const schema = new TroopLandScoreboardPlayerEntry();
    syncBasePlayerFields(schema, entry, metadataByPlayer);
    schema.troops = entry.troops;
    schema.land = entry.land;
    target.players.push(schema);
  }
}

/**
 * Copies shared row identity fields from server-owned public player metadata.
 */
function syncBasePlayerFields(
  target: TroopLandScoreboardPlayerEntry,
  source: TroopLandScoreEntry,
  metadataByPlayer: ReadonlyMap<string, PlayerScoreboardMetadata>,
) {
  const metadata = metadataByPlayer.get(source.playerId);
  target.playerId = source.playerId;
  target.teamId = source.teamId || metadata?.teamId || "";
  target.displayName = metadata?.displayName || source.playerId;
  target.color = metadata?.color ?? 0;
}
