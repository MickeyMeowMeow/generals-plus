import type { ICoordinate } from "@generals-plus/engine";
import { DefaultGridGenerator } from "@generals-plus/engine";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GameApp } from "#/features/game/renderer/game-app";
import type { MoveDirection, MoveIntent } from "#/features/game/renderer/move";
import { getTargetCoord } from "#/features/game/renderer/move";

export function GamePage() {
  const [tick, setTick] = useState(0);
  const [selection, setSelection] = useState<ICoordinate | null>(null);
  const [moveQueue, setMoveQueue] = useState<MoveIntent[]>([]);

  const onSelectCell = useCallback((coord: ICoordinate) => {
    setSelection(coord);
  }, []);

  const handleQueueMove = useCallback(
    (direction: MoveDirection) => {
      if (!selection) return;
      const from = selection;
      const newMove = { from, direction };

      setSelection(getTargetCoord(newMove));
      setMoveQueue((prev) => [...prev, newMove]);

      // TODO: Sync with colyseus
    },
    [selection],
  );

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
      <GameApp
        grid={grid}
        selection={selection}
        moveQueue={moveQueue}
        onSelectCell={onSelectCell}
        onQueueMove={handleQueueMove}
      />
    </div>
  );
}
