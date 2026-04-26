import { MockGridGenerator } from "@generals-plus/engine";
import { useEffect, useMemo, useState } from "react";

import { GameApp } from "#features/game/renderer/GameApp.tsx";

export function GamePage() {
  const [tick, setTick] = useState(0);

  /**
   * Keep mock data stable across React renders so Pixi only redraws on real grid changes.
   */
  const grid = useMemo(
    () =>
      MockGridGenerator.generate({
        width: 28,
        height: 18,
        seed: tick,
      }),
    [tick],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t: number) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <GameApp grid={grid} />;
}
