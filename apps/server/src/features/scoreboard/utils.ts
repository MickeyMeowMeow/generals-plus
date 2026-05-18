import type {
  GameMode as GameModeType,
  IBaseScoreboard,
  IClassicScoreboard,
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
  TurfWarScoreboard,
  TurfWarScoreboardPlayerEntry,
  TurfWarScoreboardTeamEntry,
} from "@generals-plus/shared-types";

export function createScoreboard(mode: GameModeType): BaseScoreboard {
  let scoreboard: BaseScoreboard;
  switch (mode) {
    case GameMode.TURF_WAR:
      scoreboard = new TurfWarScoreboard();
      break;
    default:
      scoreboard = new ClassicScoreboard();
      break;
  }
  scoreboard.mode = mode;
  return scoreboard;
}

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
