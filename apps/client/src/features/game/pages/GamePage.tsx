import { DefaultGridGenerator } from "@generals-plus/engine";
import { useEffect, useMemo, useState } from "react";

import { GameApp } from "#/features/game/renderer/GameApp";
import type { RenderCell } from "#/features/game/renderer/render-types";

export function GamePage() {
  const [_tick, setTick] = useState(0);

  // TODO: Load generator from config
  const generator = useMemo(() => new DefaultGridGenerator(), []);

  const grid = useMemo(
    () =>
      generator.generate({
        width: 28,
        height: 18,
        seed: 20260428,
      }),
    [generator],
  );

  const cells = useMemo<RenderCell[]>(() => {
    // Adapt engine cells into the renderer-facing DTO shape.
    const renderCells: RenderCell[] = [];
    grid.forEach((cell) => {
      renderCells.push({
        x: cell.coordinate.x,
        y: cell.coordinate.y,
        terrain: cell.terrain,
        troopCount: cell.troopCount ?? 0,
        ownerIndex: -1,
        isVisible: true,
      });
    });
    return renderCells;
  }, [grid]);

  useEffect(() => {
    // Demo loop: regenerate map snapshots periodically.
    const id = setInterval(() => {
      setTick((t: number) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <GameApp
      width={grid.width}
      height={grid.height}
      cells={cells}
      players={[]}
      moveQueue={[]}
    />
  );
}
