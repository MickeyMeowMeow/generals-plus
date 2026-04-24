import { MockGridGenerator } from "@generals-plus/engine";
import { useMemo } from "react";

import { PixiStage } from "#features/match/renderer/PixiStage";

/**
 * Match page shell for the current local-rendering milestone.
 */
export function MatchScreen() {
  /**
   * Keep mock data stable across React renders so Pixi only redraws on real grid changes.
   */
  const grid = useMemo(
    () =>
      MockGridGenerator.generate({
        width: 28,
        height: 18,
        seed: 42,
      }),
    [],
  );

  return (
    <main className="match-screen">
      <section className="match-board" aria-label="Generals Hub match board">
        <PixiStage grid={grid} />
      </section>
    </main>
  );
}
