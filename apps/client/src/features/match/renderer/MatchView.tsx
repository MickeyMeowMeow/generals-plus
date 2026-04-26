import { Application } from "@pixi/react";
import { Assets } from "pixi.js";
import { useEffect, useState } from "react";

import { Viewport } from "#/components/pixi/Viewport";
import { RenderConfig } from "#/features/match/renderer/render-config.ts";
import { TerrainIconUrls } from "#/features/match/renderer/terrain-assets";
import type { RenderGrid } from "#features/match/renderer/GridLayer.tsx";
import { GridLayer } from "#features/match/renderer/GridLayer.tsx";

interface MatchViewProps {
  /** Grid snapshot to render. */
  readonly grid: RenderGrid;
}

export function MatchView({ grid }: MatchViewProps) {
  const [isReady, setIsReady] = useState(false);

  const worldWidth =
    grid.width * RenderConfig.cellStride - RenderConfig.cellGap;
  const worldHeight =
    grid.height * RenderConfig.cellStride - RenderConfig.cellGap;

  useEffect(() => {
    // Preload terrain icon assets.
    const preloadAssets = async () => {
      const urls = Object.values(TerrainIconUrls);
      await Assets.load(urls);
    };
    preloadAssets().then(() => setIsReady(true));
  }, []);

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
        <GridLayer grid={grid} stride={RenderConfig.cellStride} />
      </Viewport>
    </Application>
  );
}
