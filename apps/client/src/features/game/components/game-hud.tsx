import type { BaseScoreboard } from "@generals-plus/shared-types";
import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";

import { FloatingHud } from "#/components/layout";
import { Separator } from "#/components/ui/separator";
import { colorToHex } from "#/features/game/components/room-controls";
import { TimerBar } from "#/features/game/components/timer-bar";
import { createGameHudScoreboardModel } from "#/features/match/utils/scoreboard-adapter";
import { AnimatedNumber } from "#/features/motion/components/animated-number";
import { MOTION_DURATION } from "#/features/motion/motion-tokens";

interface TimerProps {
  currentTick: number;
  targetTick: number;
  tickInterval: number;
  startTick?: number;
}

interface GameHudProps {
  /** Authoritative scoreboard schema from the match room state. */
  scoreboard: BaseScoreboard;
  timer?: TimerProps;
  targetScore?: number;
}

/**
 * Builds the CSS grid template for score headers, player rows, and aggregate rows.
 */
function getScoreboardGridStyle(columnCount: number): CSSProperties {
  return {
    gridTemplateColumns: `minmax(0, 1fr) repeat(${columnCount}, minmax(2.6rem, auto))`,
  };
}

/**
 * Normalizes missing HUD metric values to an empty cell.
 */
function formatValue(value: number | string | undefined) {
  return value ?? "";
}

/**
 * Wraps HUD metric values in the shared per-digit animation while leaving
 * empty cells blank.
 */
function renderMetricValue(value: number | string | undefined) {
  const formatted = formatValue(value);

  if (formatted === "") {
    return "";
  }

  return <AnimatedNumber value={String(formatted)} className="justify-end" />;
}

/**
 * Floating in-game HUD for connection state and mode-specific scoreboard data.
 */
export function GameHud({ scoreboard, timer, targetScore }: GameHudProps) {
  const scoreboardModel = createGameHudScoreboardModel(scoreboard, targetScore);
  const shouldShowGroupRows = scoreboardModel.hasTeams;
  const ungroupedRows = scoreboardModel.groups
    .flatMap((group) => group.rows)
    .sort(
      (a, b) =>
        Number(b.values.troops) - Number(a.values.troops) ||
        a.label.localeCompare(b.label),
    );
  const shouldShowTimer =
    timer && timer.targetTick > 0 && timer.tickInterval > 0;

  return (
    <FloatingHud>
      <motion.div
        key={`${scoreboardModel.title}:${scoreboardModel.subtitle ?? ""}`}
        layout
        data-motion-surface="hud"
        initial={{ opacity: 0.96, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          layout: { duration: MOTION_DURATION.normal },
          duration: MOTION_DURATION.fast,
        }}
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {shouldShowTimer ? (
            <motion.div
              key="timer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: MOTION_DURATION.fast }}
              style={{ overflow: "hidden" }}
            >
              <TimerBar
                currentTick={timer.currentTick}
                targetTick={timer.targetTick}
                tickInterval={timer.tickInterval}
                startTick={timer.startTick}
              />
              <Separator className="bg-game-border/70" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <h2 className="text-[15px] font-semibold text-game-text">
              {scoreboardModel.title}
            </h2>
            {scoreboardModel.subtitle ? (
              <span className="text-[15px] font-semibold text-game-text">
                {scoreboardModel.subtitle}
              </span>
            ) : null}
          </div>

          <div
            className="grid gap-x-2 gap-y-1.5 items-center"
            style={getScoreboardGridStyle(scoreboardModel.columns.length)}
          >
            {/* Header Row */}
            <span className="text-left text-[11px] font-semibold uppercase tracking-wider text-game-text-dim/80">
              {shouldShowGroupRows ? "Teams" : "Players"}
            </span>
            {scoreboardModel.columns.map((column) => (
              <span
                key={column.key}
                className="text-right text-[11px] font-semibold uppercase tracking-wider text-game-text-dim/80"
              >
                {column.label}
              </span>
            ))}

            {/* Content Rows */}
            {shouldShowGroupRows
              ? scoreboardModel.groups.flatMap((group, groupIdx) => {
                  const groupRows: React.ReactNode[] = [];

                  // Divider line before team (except the first team)
                  if (groupIdx > 0) {
                    groupRows.push(
                      <div
                        key={`sep-${group.id}`}
                        className="col-span-full border-t border-game-border/70 my-1"
                      />,
                    );
                  }

                  // Team Totals row
                  groupRows.push(
                    <span
                      key={`group-label-${group.id}`}
                      className="truncate text-[13px] font-semibold uppercase tracking-wide text-game-text-dim"
                    >
                      {group.label}
                    </span>,
                  );
                  scoreboardModel.columns.forEach((column) => {
                    groupRows.push(
                      <span
                        key={`group-metric-${group.id}-${column.key}`}
                        className="text-right tabular-nums text-[13px] font-semibold"
                      >
                        {renderMetricValue(group.totals?.[column.key])}
                      </span>,
                    );
                  });

                  // Players under this Team
                  group.rows.forEach((player) => {
                    groupRows.push(
                      <div
                        key={`player-name-${player.id}`}
                        className="flex items-center gap-1.5 min-w-0 text-[13px] font-normal tracking-wide"
                      >
                        <span
                          className={`size-2.5 shrink-0 ${player.isAlive ? "" : "opacity-40"}`}
                          style={{ backgroundColor: colorToHex(player.color) }}
                        />
                        <span
                          className={`truncate ${player.isAlive ? "" : "text-game-text-dim/50"}`}
                        >
                          {player.label}
                        </span>
                      </div>,
                    );
                    scoreboardModel.columns.forEach((column) => {
                      groupRows.push(
                        <span
                          key={`player-metric-${player.id}-${column.key}`}
                          className={`text-right tabular-nums text-[13px] font-normal ${player.isAlive ? "" : "text-game-text-dim/50"}`}
                        >
                          {renderMetricValue(player.values?.[column.key])}
                        </span>,
                      );
                    });
                  });

                  return groupRows;
                })
              : ungroupedRows.flatMap((player, idx) => {
                  const playerRows: React.ReactNode[] = [];

                  // Divider line before player list
                  if (idx === 0) {
                    playerRows.push(
                      <div
                        key="sep-ungrouped"
                        className="col-span-full border-t border-game-border/70 my-1"
                      />,
                    );
                  }

                  // Player row
                  playerRows.push(
                    <div
                      key={`player-name-${player.id}`}
                      className="flex items-center gap-1.5 min-w-0 text-[13px] font-normal tracking-wide"
                    >
                      <span
                        className={`size-2.5 shrink-0 ${player.isAlive ? "" : "opacity-40"}`}
                        style={{ backgroundColor: colorToHex(player.color) }}
                      />
                      <span
                        className={`truncate ${player.isAlive ? "" : "text-game-text-dim/50"}`}
                      >
                        {player.label}
                      </span>
                    </div>,
                  );
                  scoreboardModel.columns.forEach((column) => {
                    playerRows.push(
                      <span
                        key={`player-metric-${player.id}-${column.key}`}
                        className={`text-right tabular-nums text-[13px] font-normal ${player.isAlive ? "" : "text-game-text-dim/50"}`}
                      >
                        {renderMetricValue(player.values?.[column.key])}
                      </span>,
                    );
                  });

                  return playerRows;
                })}
          </div>
        </div>
      </motion.div>
    </FloatingHud>
  );
}
