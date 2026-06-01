import type {
  GameMode as GameModeType,
  IBaseScoreboard,
  IClassicScoreboard,
  ICollapseScoreboard,
  IDemolitionScoreboard,
  IDominationScoreboard,
  IPayloadScoreboard,
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
  CollapseScoreboard,
  CollapseScoreboardPlayerEntry,
  DemolitionScoreboard,
  DemolitionScoreboardPlayerEntry,
  DemolitionScoreboardTeamEntry,
  DominationScoreboard,
  DominationScoreboardPlayerEntry,
  DominationScoreboardTeamEntry,
  PayloadScoreboard,
  PayloadScoreboardPlayerEntry,
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
    case GameMode.DEMOLITION:
      scoreboard = new DemolitionScoreboard();
      break;
    case GameMode.COLLAPSE:
      scoreboard = new CollapseScoreboard();
      break;
    case GameMode.PAYLOAD:
      scoreboard = new PayloadScoreboard();
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
  tickInterval?: number,
): void {
  target.mode = source.mode;
  const metadataByPlayer = new Map(
    Array.from(playerMetadata).map((player) => [player.id, player]),
  );

  switch (source.mode) {
    case GameMode.COLLAPSE: {
      const collapseTarget = target as CollapseScoreboard;
      const collapseSource = source as ICollapseScoreboard;
      syncPlayers(
        collapseTarget,
        collapseSource.players,
        metadataByPlayer,
        () => new CollapseScoreboardPlayerEntry(),
        (schema, entry) => {
          if (schema.troops !== entry.troops) schema.troops = entry.troops;
          if (schema.land !== entry.land) schema.land = entry.land;
          if (schema.isAlive !== entry.isAlive) schema.isAlive = entry.isAlive;
        },
      );
      collapseTarget.nextCollapseTick = collapseSource.nextCollapseTick;
      collapseTarget.currentProgress = collapseSource.currentProgress;
      collapseTarget.startDelayTicks = collapseSource.startDelayTicks;
      collapseTarget.shrinkIntervalTicks = collapseSource.shrinkIntervalTicks;
      break;
    }
    case GameMode.PAYLOAD: {
      const payloadTarget = target as PayloadScoreboard;
      const payloadSource = source as IPayloadScoreboard;
      syncPlayers(
        payloadTarget,
        payloadSource.players,
        metadataByPlayer,
        () => new PayloadScoreboardPlayerEntry(),
        (schema, entry) => {
          if (schema.troops !== entry.troops) schema.troops = entry.troops;
          if (schema.land !== entry.land) schema.land = entry.land;
          if (schema.isAlive !== entry.isAlive) schema.isAlive = entry.isAlive;
        },
      );
      const interval = tickInterval ?? 500;
      payloadTarget.cartProgress = payloadSource.cartProgress;
      payloadTarget.cartIndex = payloadSource.cartIndex;
      payloadTarget.trackLength = payloadSource.trackLength;
      payloadTarget.totalTime =
        (payloadSource.totalTimeTicks * interval) / 1000;
      payloadTarget.speedSeconds = (payloadSource.speedTicks * interval) / 1000;
      payloadTarget.cartSize = payloadSource.cartSize;
      payloadTarget.minPushers = payloadSource.minPushers;
      payloadTarget.isContested = payloadSource.isContested;
      payloadTarget.pushingTeamId = payloadSource.pushingTeamId ?? "";
      payloadTarget.leftTeamId = payloadSource.leftTeamId;
      payloadTarget.rightTeamId = payloadSource.rightTeamId;
      break;
    }
    case GameMode.CLASSIC: {
      const classicTarget = target as ClassicScoreboard;
      const classicSource = source as IClassicScoreboard;
      syncPlayers(
        classicTarget,
        classicSource.players,
        metadataByPlayer,
        () => new ClassicScoreboardPlayerEntry(),
        (schema, entry) => {
          if (schema.troops !== entry.troops) schema.troops = entry.troops;
          if (schema.land !== entry.land) schema.land = entry.land;
          if (schema.isAlive !== entry.isAlive) schema.isAlive = entry.isAlive;
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
          if (schema.troops !== entry.troops) schema.troops = entry.troops;
          if (schema.land !== entry.land) schema.land = entry.land;
          if (schema.isAlive !== entry.isAlive) schema.isAlive = entry.isAlive;
        },
      );
      // Incremental team sync
      if (turfTarget.teams.length !== turfSource.teams.length) {
        turfTarget.teams.clear();
        for (const entry of turfSource.teams) {
          const schema = new TurfWarScoreboardTeamEntry();
          schema.teamId = entry.teamId;
          schema.landPercent = entry.landPercent;
          schema.playerIds.push(...entry.playerIds);
          turfTarget.teams.push(schema);
        }
      } else {
        for (let i = 0; i < turfSource.teams.length; i++) {
          const entry = turfSource.teams[i];
          const schema = turfTarget.teams[i];
          if (schema.teamId !== entry.teamId) schema.teamId = entry.teamId;
          if (schema.landPercent !== entry.landPercent)
            schema.landPercent = entry.landPercent;
          syncStringArray(schema.playerIds, entry.playerIds);
        }
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
          if (schema.troops !== entry.troops) schema.troops = entry.troops;
          if (schema.land !== entry.land) schema.land = entry.land;
          if (schema.isAlive !== entry.isAlive) schema.isAlive = entry.isAlive;
        },
      );
      {
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
        const teamEntries = Array.from(domSource.teamScores.entries());
        if (domTarget.teams.length !== teamEntries.length) {
          domTarget.teams.clear();
          for (const [teamId, score] of teamEntries) {
            const schema = new DominationScoreboardTeamEntry();
            schema.teamId = teamId;
            schema.score = score;
            const ids = teamPlayers.get(teamId);
            if (ids) schema.playerIds.push(...ids);
            domTarget.teams.push(schema);
          }
        } else {
          for (let i = 0; i < teamEntries.length; i++) {
            const [teamId, score] = teamEntries[i];
            const schema = domTarget.teams[i];
            if (schema.teamId !== teamId) schema.teamId = teamId;
            if (schema.score !== score) schema.score = score;
            syncStringArray(schema.playerIds, teamPlayers.get(teamId) ?? []);
          }
        }
      }
      break;
    }
    case GameMode.DEMOLITION: {
      const demoTarget = target as DemolitionScoreboard;
      const demoSource = source as IDemolitionScoreboard;
      syncPlayers(
        demoTarget,
        demoSource.players,
        metadataByPlayer,
        () => new DemolitionScoreboardPlayerEntry(),
        (schema, entry) => {
          if (schema.troops !== entry.troops) schema.troops = entry.troops;
          if (schema.land !== entry.land) schema.land = entry.land;
          if (schema.isAlive !== entry.isAlive) schema.isAlive = entry.isAlive;
        },
      );
      {
        const teamPlayers = new Map<string, string[]>();
        for (const entry of demoSource.players) {
          const meta = metadataByPlayer.get(entry.playerId);
          const teamId = meta?.teamId ?? "";
          let ids = teamPlayers.get(teamId);
          if (!ids) {
            ids = [];
            teamPlayers.set(teamId, ids);
          }
          ids.push(entry.playerId);
        }
        const teamIds = Array.from(teamPlayers.keys());
        if (demoTarget.teams.length !== teamIds.length) {
          demoTarget.teams.clear();
          for (const teamId of teamIds) {
            const schema = new DemolitionScoreboardTeamEntry();
            schema.teamId = teamId;
            const ids = teamPlayers.get(teamId);
            if (ids) schema.playerIds.push(...ids);
            demoTarget.teams.push(schema);
          }
        } else {
          for (let i = 0; i < teamIds.length; i++) {
            const teamId = teamIds[i];
            const schema = demoTarget.teams[i];
            if (schema.teamId !== teamId) schema.teamId = teamId;
            syncStringArray(schema.playerIds, teamPlayers.get(teamId) ?? []);
          }
        }
      }
      if (demoTarget.bombSiteCount !== demoSource.bombSiteCount)
        demoTarget.bombSiteCount = demoSource.bombSiteCount;
      {
        const plantedAtSite = demoSource.plantedAtSite ?? "";
        if (demoTarget.plantedAtSite !== plantedAtSite)
          demoTarget.plantedAtSite = plantedAtSite;
      }
      {
        const detonationTick = demoSource.detonationTick ?? -1;
        if (demoTarget.detonationTick !== detonationTick)
          demoTarget.detonationTick = detonationTick;
      }
      if (demoTarget.plantProgressTicks !== demoSource.plantProgressTicks)
        demoTarget.plantProgressTicks = demoSource.plantProgressTicks;
      if (demoTarget.defuseProgressTicks !== demoSource.defuseProgressTicks)
        demoTarget.defuseProgressTicks = demoSource.defuseProgressTicks;
      {
        const defuserId = demoSource.defuserId ?? "";
        if (demoTarget.defuserId !== defuserId)
          demoTarget.defuserId = defuserId;
      }
      if (demoTarget.isPlanted !== demoSource.isPlanted)
        demoTarget.isPlanted = demoSource.isPlanted;
      if (demoTarget.isDefused !== demoSource.isDefused)
        demoTarget.isDefused = demoSource.isDefused;
      if (demoTarget.plantDurationTicks !== demoSource.plantDurationTicks)
        demoTarget.plantDurationTicks = demoSource.plantDurationTicks;
      if (demoTarget.defuseDurationTicks !== demoSource.defuseDurationTicks)
        demoTarget.defuseDurationTicks = demoSource.defuseDurationTicks;
      if (demoTarget.detonateDurationTicks !== demoSource.detonateDurationTicks)
        demoTarget.detonateDurationTicks = demoSource.detonateDurationTicks;
      break;
    }
    default:
      syncPlayers(
        target as ClassicScoreboard,
        (source as IClassicScoreboard).players,
        metadataByPlayer,
        () => new ClassicScoreboardPlayerEntry(),
        (schema, entry) => {
          if (schema.troops !== entry.troops) schema.troops = entry.troops;
          if (schema.land !== entry.land) schema.land = entry.land;
          if (schema.isAlive !== entry.isAlive) schema.isAlive = entry.isAlive;
        },
      );
      break;
  }
}

function syncPlayers<
  T extends BaseScoreboardPlayerEntry,
  E extends { readonly playerId: string },
>(
  target: {
    players: {
      clear(): void;
      push(item: T): void;
      readonly length: number;
      [index: number]: T;
    };
  },
  entries: readonly E[],
  metadataByPlayer: ReadonlyMap<string, PublicPlayer>,
  createEntry: () => T,
  configure?: (schema: T, entry: E) => void,
) {
  // Player count changed: full rebuild
  if (target.players.length !== entries.length) {
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
    return;
  }

  // Incremental update: reuse existing entries, only mutate changed fields
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const schema = target.players[i];
    const metadata = metadataByPlayer.get(entry.playerId);

    if (schema.playerId !== entry.playerId) schema.playerId = entry.playerId;
    const teamId = metadata?.teamId ?? "";
    if (schema.teamId !== teamId) schema.teamId = teamId;
    const displayName = metadata?.displayName ?? entry.playerId;
    if (schema.displayName !== displayName) schema.displayName = displayName;
    const color = metadata?.color ?? 0;
    if (schema.color !== color) schema.color = color;
    configure?.(schema, entry);
  }
}

/**
 * Incrementally sync a primitive ArraySchema<string> with a source array,
 * only mutating indices whose value actually changed.
 */
function syncStringArray(
  target: {
    clear(): void;
    push(...items: string[]): void;
    readonly length: number;
    [index: number]: string;
  },
  source: readonly string[],
): void {
  if (target.length !== source.length) {
    target.clear();
    target.push(...source);
    return;
  }
  for (let i = 0; i < source.length; i++) {
    if (target[i] !== source[i]) {
      target[i] = source[i];
    }
  }
}
