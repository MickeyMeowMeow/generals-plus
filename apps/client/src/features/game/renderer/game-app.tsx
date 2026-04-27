import { Application } from "@pixi/react";
import { Assets } from "pixi.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Viewport } from "#/components/pixi/Viewport";
import { GridLayer } from "#/features/game/renderer/GridLayer";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type {
  GameMapCallbacks,
  GameMapProps,
  RenderViewportState,
} from "#/features/game/renderer/render-types";
import { TerrainTheme } from "#/features/game/renderer/theme";

interface GameAppProps extends GameMapProps, GameMapCallbacks {}

export function GameApp({
  width,
  height,
  cells,
  players,
  moveQueue,
  onCellClick,
  onCellHover,
  onCellLeave,
  onCellsSelect,
  onQueueItemRemove,
}: GameAppProps) {
  const [isReady, setIsReady] = useState(false);

  // Compute world-space dimensions from cell metrics.
  const worldWidth = width * RenderConfig.cellStride - RenderConfig.cellGap;
  const worldHeight = height * RenderConfig.cellStride - RenderConfig.cellGap;
  const initialViewport = useMemo<RenderViewportState>(
    () => ({
      left: 0,
      top: 0,
      right: worldWidth,
      bottom: worldHeight,
      scale: RenderConfig.maxScale,
    }),
    [worldHeight, worldWidth],
  );
  const [viewport, setViewport] =
    useState<RenderViewportState>(initialViewport);
  // Receive camera bounds from the viewport wrapper.
  const handleViewportChange = useCallback((bounds: RenderViewportState) => {
    setViewport(bounds);
  }, []);

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
    // Reset view state whenever map dimensions change.
    setViewport(initialViewport);
  }, [initialViewport]);

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
        onViewportChange={handleViewportChange}
      >
        <GridLayer
          width={width}
          height={height}
          cells={cells}
          players={players}
          moveQueue={moveQueue}
          viewport={viewport}
          stride={RenderConfig.cellStride}
          onCellClick={onCellClick}
          onCellHover={onCellHover}
          onCellLeave={onCellLeave}
          onCellsSelect={onCellsSelect}
          onQueueItemRemove={onQueueItemRemove}
        />
      </Viewport>
    </Application>
  );
}
