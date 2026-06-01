import { AnimatedNumber } from "#/features/motion/components/animated-number";

export function TurnCounter({ tick }: { tick: number }) {
  return (
    <div className="inline-flex items-center rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.76)] px-3 py-1.5 shadow-xl shadow-black/25 backdrop-blur-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-game-text-dim/80">
        Turn
      </span>
      <span className="ml-2 text-[15px] font-semibold tabular-nums text-game-text">
        <AnimatedNumber value={tick} />
      </span>
    </div>
  );
}
