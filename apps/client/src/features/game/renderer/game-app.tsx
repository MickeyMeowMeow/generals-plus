import type { ICoordinate } from "@generals-plus/engine";
import { Application } from "@pixi/react";
import { Assets } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import { MapRenderer } from "#/features/game/renderer/map-renderer";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";
import { Viewport } from "#/features/game/renderer/viewport";
import type { MoveDirection, MoveIntent } from "#/features/game/utils/move";
import { KeyToDirection } from "#/features/game/utils/move";
import { cn } from "#/lib/utils";

interface GameAppProps {
  /** Grid snapshot to render. */
  readonly grid: RenderGrid;
  readonly selection: ICoordinate | null;
  readonly moveQueue: MoveIntent[];
  readonly onSelectCell: (coord: ICoordinate) => void;
  readonly onQueueMove: (direction: MoveDirection) => void;
  readonly playerColors: Map<string, number>;
  readonly className?: string;
}

/**
 * Pixi match canvas sized by its parent container.
 *
 * The renderer keeps input logic in Pixi while React owns HUD and result UI
 * around it, allowing the game page to use the full browser viewport.
 */
export function GameApp({
  grid,
  selection,
  moveQueue,
  onSelectCell,
  onQueueMove,
  playerColors,
  className,
}: GameAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  return (
    <div ref={containerRef} className={cn("h-full w-full", className)}>
      {!isReady ? (
        <div className="grid h-full place-items-center text-sm text-game-text-dim">
          Loading battlefield
        </div>
      ) : (
        <Application
          resizeTo={containerRef}
          className="h-full w-full"
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
        </Application>
      )}
    </div>
  );
}
