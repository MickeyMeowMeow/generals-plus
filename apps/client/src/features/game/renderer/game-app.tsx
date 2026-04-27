import type { ICoordinate } from "@generals-plus/engine";
import { Application } from "@pixi/react";
import { Assets } from "pixi.js";
import { useEffect, useState } from "react";

import type { RenderGrid } from "#/features/game/renderer/grid-layer.tsx";
import { GridLayer } from "#/features/game/renderer/grid-layer.tsx";
import type { MoveDirection, MoveIntent } from "#/features/game/renderer/move";
import { KeyToDirection } from "#/features/game/renderer/move";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";
import { Viewport } from "#/features/game/renderer/viewport";

interface GameAppProps {
  /** Grid snapshot to render. */
  readonly grid: RenderGrid;
  readonly selection: ICoordinate | null;
  readonly moveQueue: MoveIntent[];
  readonly onSelectCell: (coord: ICoordinate) => void;
  readonly onQueueMove: (direction: MoveDirection) => void;
}

export function GameApp({
  grid,
  selection,
  moveQueue,
  onSelectCell,
  onQueueMove,
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
        onQueueMove(KeyToDirection[key]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onQueueMove]);

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
        <GridLayer
          grid={grid}
          stride={RenderConfig.cellStride}
          selection={selection}
          moveQueue={moveQueue}
          onCellClick={onSelectCell}
        />
      </Viewport>
    </Application>
  );
}
