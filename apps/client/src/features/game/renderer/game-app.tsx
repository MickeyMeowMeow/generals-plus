import type { ICoordinate } from "@generals-plus/engine";
import { Application } from "@pixi/react";
import { Assets } from "pixi.js";
import { useEffect, useState } from "react";

import { MapRenderer } from "#/features/game/renderer/map-renderer";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { ScoreboardOverlay } from "#/features/game/renderer/scoreboard-overlay";
import type { RenderScoreboardData } from "#/features/game/renderer/scoreboard-types";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";
import { Viewport } from "#/features/game/renderer/viewport";
import type { MoveDirection, MoveIntent } from "#/features/game/utils/move";
import { KeyToDirection } from "#/features/game/utils/move";

interface GameAppProps {
  /** Grid snapshot to render. */
  readonly grid: RenderGrid;
  readonly selection: ICoordinate | null;
  readonly moveQueue: MoveIntent[];
  readonly scoreboard: RenderScoreboardData | null;
  readonly canQueueMove: boolean;
  readonly onSelectCell: (coord: ICoordinate) => void;
  readonly onQueueMove: (direction: MoveDirection) => void;
  readonly playerColors: Map<string, number>;
}

export function GameApp({
  grid,
  selection,
  moveQueue,
  scoreboard,
  canQueueMove,
  onSelectCell,
  onQueueMove,
  playerColors,
}: GameAppProps) {
  const [isReady, setIsReady] = useState(false);

  const worldWidth =
    grid.width * RenderConfig.cellStride - RenderConfig.cellGap;
  const worldHeight =
    grid.height * RenderConfig.cellStride - RenderConfig.cellGap;

  useEffect(() => {
    // Preload terrain icon assets.
    const preloadAssets = async () => {
      const icons = Object.values(TerrainTheme)
        .map((theme) => theme.icon)
        .filter((icon): icon is string => icon !== undefined);
      await Assets.load(icons);
    };
    preloadAssets().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KeyToDirection[key]) {
        e.preventDefault();
        if (!canQueueMove) return;
        onQueueMove(KeyToDirection[key]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canQueueMove, onQueueMove]);

  if (!isReady) {
    return <div>Loading...</div>;
  }

  return (
    <Application
      backgroundColor={RenderConfig.stageBackground}
      antialias={true}
      autoDensity={true}
      resolution={window.devicePixelRatio}
    >
      <Viewport
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        minScale={RenderConfig.minScale}
        maxScale={RenderConfig.maxScale}
      >
        <MapRenderer
          grid={grid}
          stride={RenderConfig.cellStride}
          selection={selection}
          moveQueue={moveQueue}
          onCellClick={onSelectCell}
          playerColors={playerColors}
        />
      </Viewport>
      <ScoreboardOverlay data={scoreboard} />
    </Application>
  );
}
