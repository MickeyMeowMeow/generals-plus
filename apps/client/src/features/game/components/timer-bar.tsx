import { Progress } from "#/components/ui/progress";
import { cn, formatTime } from "#/lib/utils";

const TimeThreshold = {
  WARNING_SECONDS: 30,
  CRITICAL_SECONDS: 10,
} as const;

interface TimerBarProps {
  /** The current simulation tick from the server. */
  currentTick: number;
  /** The tick at which the game or phase ends. */
  targetTick: number;
  /** Interval between ticks in milliseconds, used to convert ticks to time. */
  tickInterval: number;
  /** Text displayed above the progress bar. */
  label?: string;
  /** Optional start tick of the current phase to calculate relative progress. */
  startTick?: number;
}

/**
 * A progress bar synchronized with the server's tick counter.
 * Fills from left to right as the match progresses.
 */
export function TimerBar({
  currentTick,
  targetTick,
  tickInterval,
  label = "Time remaining",
  startTick = 0,
}: TimerBarProps) {
  const range = targetTick - startTick;
  const currentElapsed = currentTick - startTick;
  const progressPercentage = range > 0 ? (currentElapsed / range) * 100 : 0;

  // Calculate remaining time in seconds
  const remainingTicks = Math.max(0, targetTick - currentTick);
  const remainingSeconds = (remainingTicks * tickInterval) / 1000;

  // Determine urgency state for styling
  const isCritical = remainingSeconds <= TimeThreshold.CRITICAL_SECONDS;
  const isWarning = remainingSeconds <= TimeThreshold.WARNING_SECONDS;

  return (
    <section aria-label="Match timer" className="flex w-full flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-game-text-dim">
          {label}
        </span>
        <span
          data-motion-emphasis={
            isCritical ? "critical" : isWarning ? "warning" : "normal"
          }
          className={cn(
            "text-sm font-medium tabular-nums transition-[color,transform] duration-(--motion-duration-fast) ease-(--motion-ease-emphasis)",
            isCritical
              ? "text-timer-critical"
              : isWarning
                ? "text-timer-warning"
                : "text-timer-normal",
          )}
        >
          {formatTime(remainingSeconds)}
        </span>
      </div>
      <Progress
        value={Math.min(100, progressPercentage)}
        className={cn(
          "h-1.5 border border-game-border bg-game-bg transition-[border-color,background-color] duration-(--motion-duration-fast) ease-(--motion-ease-enter)",
          isCritical
            ? "[&>div]:bg-timer-critical"
            : isWarning
              ? "[&>div]:bg-timer-warning"
              : "[&>div]:bg-timer-normal",
        )}
      />
    </section>
  );
}
