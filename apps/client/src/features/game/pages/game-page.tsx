import { DefaultGridGenerator } from "@generals-plus/engine";
import { useEffect, useMemo, useState } from "react";

import { GameApp } from "#/features/game/renderer/game-app.tsx";

export function GamePage() {
  const [tick, setTick] = useState(0);

  // TODO: Load generator from config
  const generator = useMemo(() => new DefaultGridGenerator(), []);

  const grid = useMemo(
    () =>
      generator.generate({
        width: 28,
        height: 18,
        seed: tick,
      }),
    [generator, tick],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t: number) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex justify-center">
      <GameApp grid={grid} />
    </div>
  );
}
