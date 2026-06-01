import { GameMode } from "@generals-plus/engine";
import type {
  BiohazardScoreboard,
  CollapseScoreboard,
  DemolitionScoreboard,
  MatchState,
  RugbyScoreboard,
} from "@generals-plus/shared-types";

export function parseTimerProps(gameState: MatchState) {
  let timerProps: {
    currentTick: number;
    targetTick: number;
    tickInterval: number;
    label?: string;
    startTick?: number;
  } = {
    currentTick: gameState.tick,
    targetTick:
      gameState.mode === GameMode.TURF_WAR ||
      gameState.mode === GameMode.DOMINATION
        ? gameState.finishTick > 0
          ? gameState.finishTick
          : 0
        : 0,
    tickInterval:
      gameState.mode === GameMode.TURF_WAR ||
      gameState.mode === GameMode.DOMINATION
        ? gameState.tickInterval
        : 0,
    label: "Time remaining",
  };

  if (gameState.mode === GameMode.DEMOLITION) {
    const demoScoreboard = gameState.scoreboard as DemolitionScoreboard;

    if (demoScoreboard.plantProgressTicks > 0) {
      timerProps = {
        currentTick: demoScoreboard.plantProgressTicks,
        targetTick: demoScoreboard.plantDurationTicks,
        tickInterval: gameState.tickInterval,
        label: "Planting C4...",
      };
    } else if (demoScoreboard.defuseProgressTicks > 0) {
      timerProps = {
        currentTick: demoScoreboard.defuseProgressTicks,
        targetTick: demoScoreboard.defuseDurationTicks,
        tickInterval: gameState.tickInterval,
        label: "Defusing C4...",
      };
    } else if (demoScoreboard.plantedAtSite) {
      const remainingTicks = Math.max(
        0,
        demoScoreboard.detonationTick - gameState.tick,
      );
      const elapsedTicks = Math.max(
        0,
        demoScoreboard.detonateDurationTicks - remainingTicks,
      );

      timerProps = {
        currentTick: elapsedTicks,
        targetTick: demoScoreboard.detonateDurationTicks,
        tickInterval: gameState.tickInterval,
        label: `Bomb Planted (Site ${demoScoreboard.plantedAtSite})`,
      };
    } else {
      timerProps = {
        currentTick: gameState.tick,
        targetTick: gameState.finishTick > 0 ? gameState.finishTick : 0,
        tickInterval: gameState.tickInterval,
        label: "Time remaining",
      };
    }
  }

  if (gameState.mode === GameMode.COLLAPSE) {
    const collapseScoreboard = gameState.scoreboard as CollapseScoreboard;
    const startDelay = collapseScoreboard.startDelayTicks ?? 120;
    const shrinkInterval = collapseScoreboard.shrinkIntervalTicks ?? 60;
    const startTick =
      gameState.tick < startDelay
        ? 0
        : collapseScoreboard.nextCollapseTick - shrinkInterval;

    timerProps = {
      currentTick: gameState.tick,
      targetTick: collapseScoreboard.nextCollapseTick,
      tickInterval: gameState.tickInterval,
      label: "Void Collapse",
      startTick,
    };
  }

  if (gameState.mode === GameMode.PAYLOAD) {
    timerProps = {
      currentTick: gameState.tick,
      targetTick: gameState.finishTick > 0 ? gameState.finishTick : 0,
      tickInterval: gameState.tickInterval,
      label: "Time remaining",
    };
  }

  if (gameState.mode === GameMode.RUGBY) {
    const rugbyScoreboard = gameState.scoreboard as RugbyScoreboard;
    const totalTicks =
      rugbyScoreboard.totalTime > 0
        ? Math.round(
            (rugbyScoreboard.totalTime * 1000) /
              (gameState.tickInterval || 500),
          )
        : 0;

    timerProps = {
      currentTick: gameState.tick,
      targetTick: gameState.finishTick > 0 ? gameState.finishTick : totalTicks,
      tickInterval: gameState.tickInterval,
      label: "Time remaining",
    };
  }

  if (gameState.mode === GameMode.BIOHAZARD) {
    const bioScoreboard = gameState.scoreboard as BiohazardScoreboard;
    const isPrep = bioScoreboard.infectionPhase === "PREPARATION";
    const targetTick = isPrep
      ? bioScoreboard.outbreakTick
      : gameState.finishTick > 0
        ? gameState.finishTick
        : 0;
    const label = isPrep ? "Outbreak In" : "Time remaining";

    timerProps = {
      currentTick: gameState.tick,
      targetTick,
      tickInterval: gameState.tickInterval,
      label,
    };
  }

  return timerProps;
}
