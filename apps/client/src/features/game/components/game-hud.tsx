import type { BaseScoreboard, Player } from "@generals-plus/shared-types";
import type { CSSProperties } from "react";

import { FloatingHud } from "#/components/layout";
import { Separator } from "#/components/ui/separator";
import { colorToHex } from "#/features/game/components/room-controls";
import { TimerBar } from "#/features/game/components/timer-bar";
import type {
  GameHudColumn,
  GameHudRow,
} from "#/features/match/utils/scoreboard-adapter";
import { createGameHudScoreboardModel } from "#/features/match/utils/scoreboard-adapter";
import { cn } from "#/lib/utils";

interface TimerProps {
  currentTick: number;
  targetTick: number;
  tickInterval: number;
}

interface GameHudProps {
  /** Authoritative scoreboard schema from the match room state. */
  scoreboard: BaseScoreboard;
  /** Players currently visible to the client. */
  visiblePlayers: Iterable<Player>;
  /** Fallback player color lookup keyed by player id. */
  playerColors: Map<string, number>;
  /** Fallback display-name lookup keyed by player id. */
  playerNames: Map<string, string>;
  /** Current client's Colyseus session id, used to highlight the local player. */
  currentSessionId: string | null | undefined;
  timer?: TimerProps;
}

/**
 * Builds the CSS grid template for score headers and aggregate rows.
 */
function getScoreboardGridStyle(columnCount: number): CSSProperties {
  return {
    gridTemplateColumns: `minmax(0, 1fr) repeat(${columnCount}, minmax(2.5rem, auto))`,
  };
}

/**
 * Builds the CSS grid template for player rows, including the color swatch.
 */
function getPlayerGridStyle(columnCount: number): CSSProperties {
  return {
    gridTemplateColumns: `auto minmax(0, 1fr) repeat(${columnCount}, minmax(2.5rem, auto))`,
  };
}

/**
 * Normalizes missing HUD metric values to an empty cell.
 */
function formatValue(value: number | string | undefined) {
  return value ?? "";
}

/**
 * Renders metric cells in the same order as the active HUD columns.
 */
function MetricCells({
  columns,
  values,
}: {
  columns: GameHudColumn[];
  values: Record<string, number | string> | undefined;
}) {
  return columns.map((column) => (
    <span key={column.key} className="text-right tabular-nums">
      {formatValue(values?.[column.key])}
    </span>
  ));
}

/**
 * Renders one player entry for the match HUD scoreboard.
 */
function PlayerRow({
  columns,
  player,
}: {
  columns: GameHudColumn[];
  player: GameHudRow;
}) {
  return (
    <li
      className={cn(
        "grid items-center gap-1.5 text-[11px]",
        player.isCurrent && "font-semibold",
      )}
      style={getPlayerGridStyle(columns.length)}
    >
      <span
        className="size-2"
        style={{ backgroundColor: colorToHex(player.color) }}
      />
      <span className="truncate">{player.label}</span>
      <MetricCells columns={columns} values={player.values} />
    </li>
  );
}

/**
 * Floating in-game HUD for connection state and mode-specific scoreboard data.
 */
export function GameHud({
  scoreboard,
  visiblePlayers,
  playerColors,
  playerNames,
  currentSessionId,
  timer,
}: GameHudProps) {
  const scoreboardModel = createGameHudScoreboardModel({
    scoreboard,
    visiblePlayers,
    playerColors,
    playerNames,
    currentSessionId,
  });
  const shouldShowGroupRows = scoreboardModel.groups.some(
    (group) => group.rows.length > 1 || "score" in (group.totals ?? {}),
  );
  const ungroupedRows = scoreboardModel.groups.flatMap((group) => group.rows);
  const shouldShowTimer =
    timer && timer.targetTick > 0 && timer.tickInterval > 0;

  return (
    <FloatingHud>
      <div className="space-y-2.5">
        {shouldShowTimer ? (
          <>
            <TimerBar
              currentTick={timer.currentTick}
              targetTick={timer.targetTick}
              tickInterval={timer.tickInterval}
            />
            <Separator className="bg-game-border/70" />
          </>
        ) : null}

        <div className="space-y-2">
          <div
            className="grid gap-1.5 text-[9px] uppercase text-game-text-dim"
            style={getScoreboardGridStyle(scoreboardModel.columns.length)}
          >
            <h2 className="text-xs font-semibold normal-case text-game-text">
              {scoreboardModel.title}
            </h2>
            {scoreboardModel.columns.map((column) => (
              <span key={column.key} className="self-end text-right">
                {column.label}
              </span>
            ))}
          </div>

          {shouldShowGroupRows ? (
            scoreboardModel.groups.map((group) => (
              <section
                key={group.id}
                className="border-t border-game-border/70 pt-1.5"
              >
                <div
                  className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={getScoreboardGridStyle(scoreboardModel.columns.length)}
                >
                  <span className="truncate text-game-text-dim">
                    {group.label}
                  </span>
                  <MetricCells
                    columns={scoreboardModel.columns}
                    values={group.totals}
                  />
                </div>

                <ul className="mt-1.5 space-y-0.5">
                  {group.rows.map((player) => (
                    <PlayerRow
                      key={player.id}
                      columns={scoreboardModel.columns}
                      player={player}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <ul className="space-y-0.5 border-t border-game-border/70 pt-1.5">
              {ungroupedRows.map((player) => (
                <PlayerRow
                  key={player.id}
                  columns={scoreboardModel.columns}
                  player={player}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </FloatingHud>
  );
}
