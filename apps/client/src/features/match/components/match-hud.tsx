import type {
  BaseScoreboard,
  Player,
  ScoreboardPlayerEntry,
} from "@generals-plus/shared-types";

import { FloatingHud } from "#/components/layout";
import { colorToHex } from "#/features/game/components/room-controls";
import { cn } from "#/lib/utils";

interface MatchHudPlayer {
  id: string;
  displayName: string;
  teamId: string;
  color: number;
  land: number;
  troops: number;
  isCurrent: boolean;
}

interface MatchHudProps {
  scoreboard: BaseScoreboard;
  visiblePlayers: Iterable<Player>;
  playerColors: Map<string, number>;
  playerNames: Map<string, string>;
  currentSessionId: string | null | undefined;
  totalSeconds?: number;
  remainingSeconds?: number;
}

function getScoreEntries(scoreboard: BaseScoreboard) {
  const players = (
    scoreboard as { players?: Iterable<ScoreboardPlayerEntry> } | undefined
  )?.players;

  return players
    ? Array.from(players, (entry) => ({
        playerId: entry.playerId,
        land: entry.land,
        troops: entry.troops,
      }))
    : [];
}

function getHudPlayers({
  scoreboard,
  visiblePlayers,
  playerColors,
  playerNames,
  currentSessionId,
}: Pick<
  MatchHudProps,
  | "scoreboard"
  | "visiblePlayers"
  | "playerColors"
  | "playerNames"
  | "currentSessionId"
>): MatchHudPlayer[] {
  const scoreEntries = getScoreEntries(scoreboard);
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
        displayName:
          player?.displayName || playerNames.get(playerId) || playerId,
        teamId: player?.teamId || "",
        color: player?.color ?? playerColors.get(playerId) ?? 0,
        land: score?.land ?? 0,
        troops: score?.troops ?? 0,
        isCurrent: player?.sessionId === currentSessionId,
      };
    })
    .sort(
      (a, b) =>
        b.troops - a.troops || a.displayName.localeCompare(b.displayName),
    );
}

function groupPlayers(players: MatchHudPlayer[]) {
  const playerGroups = new Map<
    string,
    {
      label: string;
      land: number;
      troops: number;
      players: MatchHudPlayer[];
    }
  >();

  for (const player of players) {
    const teamId = player.teamId || player.id;
    const group = playerGroups.get(teamId) ?? {
      label: player.teamId ? `Team ${player.teamId}` : "Unassigned",
      land: 0,
      troops: 0,
      players: [],
    };

    group.land += player.land;
    group.troops += player.troops;
    group.players.push(player);
    playerGroups.set(teamId, group);
  }

  return Array.from(playerGroups.entries())
    .map(([teamId, group]) => ({ teamId, ...group }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function PlayerRow({ player }: { player: MatchHudPlayer }) {
  return (
    <li
      className={cn(
        "grid grid-cols-[auto_1fr_2.5rem_3.25rem] items-center gap-1.5 text-[11px]",
        player.isCurrent && "font-semibold",
      )}
    >
      <span
        className="size-2"
        style={{ backgroundColor: colorToHex(player.color) }}
      />
      <span className="truncate">{player.displayName}</span>
      <span className="text-right tabular-nums text-game-text-dim">
        {player.land}
      </span>
      <span className="text-right tabular-nums">{player.troops}</span>
    </li>
  );
}

export function MatchHud({
  scoreboard,
  visiblePlayers,
  playerColors,
  playerNames,
  currentSessionId,
}: MatchHudProps) {
  const players = getHudPlayers({
    scoreboard,
    visiblePlayers,
    playerColors,
    playerNames,
    currentSessionId,
  });
  const groupedPlayers = groupPlayers(players);
  const shouldShowTeamRows = groupedPlayers.some(
    (group) => group.players.length > 1,
  );

  return (
    <FloatingHud>
      <div className="space-y-2.5">
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_2.5rem_3.25rem] gap-1.5 text-[9px] uppercase text-game-text-dim">
            <h2 className="text-xs font-semibold normal-case text-game-text">
              Players
            </h2>
            <span className="self-end text-right">Land</span>
            <span className="self-end text-right">Soldiers</span>
          </div>

          {shouldShowTeamRows ? (
            groupedPlayers.map((group) => (
              <section
                key={group.teamId}
                className="border-t border-game-border/70 pt-1.5"
              >
                <div className="grid grid-cols-[1fr_2.5rem_3.25rem] gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                  <span className="truncate text-game-text-dim">
                    {group.label}
                  </span>
                  <span className="text-right tabular-nums">{group.land}</span>
                  <span className="text-right tabular-nums">
                    {group.troops}
                  </span>
                </div>

                <ul className="mt-1.5 space-y-0.5">
                  {group.players.map((player) => (
                    <PlayerRow key={player.id} player={player} />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <ul className="space-y-0.5 border-t border-game-border/70 pt-1.5">
              {players.map((player) => (
                <PlayerRow key={player.id} player={player} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </FloatingHud>
  );
}
