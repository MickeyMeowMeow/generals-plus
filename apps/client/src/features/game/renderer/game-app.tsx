import type { ICoordinate } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";
import { Application } from "@pixi/react";
import { Assets } from "pixi.js";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Ping } from "#/features/game/renderer/layers/ping";
import { MapRenderer } from "#/features/game/renderer/map-renderer";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";
import { Viewport } from "#/features/game/renderer/viewport";
import type { MoveDirection, MoveIntent } from "#/features/game/utils/move";
import { ClearMoveQueueKey, KeyToDirection } from "#/features/game/utils/move";

interface GameAppProps {
  /** Grid snapshot to render. */
  readonly grid: RenderGrid;
  readonly initialCoord?: ICoordinate;
  readonly selection: ICoordinate | null;
  readonly splitMoveSelection: ICoordinate | null;
  readonly moveQueue: MoveIntent[];
  readonly onSelectCell: (coord: ICoordinate) => void;
  readonly onArmSplitMove: (coord?: ICoordinate) => void;
  readonly onQueueMove: (direction: MoveDirection) => void;
  readonly onClearMoveQueue: () => void;
  readonly playerColors: Map<string, number>;
  readonly pings?: Ping[];
}

/**
 * Pixi match canvas sized by its parent container.
 *
 * The renderer keeps input logic in Pixi while React owns HUD and result UI
 * around it, allowing the game page to use the full browser viewport.
 */
export function GameApp({
  grid,
  initialCoord,
  selection,
  splitMoveSelection,
  moveQueue,
  onSelectCell,
  onArmSplitMove,
  onQueueMove,
  onClearMoveQueue,
  playerColors,
  pings = [],
}: GameAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const worldBounds = useMemo(() => {
    switch (grid.gridType) {
      case GridType.SQUARE: {
        return {
          left: -0.5 * RenderConfig.cellStride,
          right: (grid.bounds.width - 0.5) * RenderConfig.cellStride,
          top: -0.5 * RenderConfig.cellStride,
          bottom: (grid.bounds.height - 0.5) * RenderConfig.cellStride,
        };
      }
      case GridType.HEX: {
        return {
          left: -(grid.bounds.left * 1.5 - 0.5) * RenderConfig.cellStride,
          right: (grid.bounds.right * 1.5 - 0.5) * RenderConfig.cellStride,
          top: (-Math.sqrt(3) * RenderConfig.cellStride) / 2,
          bottom:
            (Math.max(grid.bounds.leftSlant, grid.bounds.rightSlant) - 0.5) *
            Math.sqrt(3) *
            RenderConfig.cellStride,
        };
      }
    }
  }, [grid.gridType, grid.bounds]);

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
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    container.addEventListener("contextmenu", handleContextMenu);
    return () => {
      container.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      console.log("Key pressed:", key);
      if (key === "z") {
        e.preventDefault();
        onArmSplitMove();
        return;
      }
      if (key === ClearMoveQueueKey) {
        e.preventDefault();
        onClearMoveQueue();
        return;
      }
      if (KeyToDirection[grid.gridType][key]) {
        e.preventDefault();
        onQueueMove(KeyToDirection[grid.gridType][key]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [grid.gridType, onArmSplitMove, onClearMoveQueue, onQueueMove]);

  const initialTarget = useMemo(() => {
    if (initialCoord) {
      const { x, y } = grid.toCartesian(initialCoord);
      return { x: x * RenderConfig.cellStride, y: y * RenderConfig.cellStride };
    }
  }, [initialCoord, grid.toCartesian]);

  return (
    <div ref={containerRef} className={"h-full w-full"}>
      {!isReady ? (
        <div className="grid h-full place-items-center text-sm text-game-text-dim">
          Loading battlefield
        </div>
      ) : (
        <Application
          resizeTo={containerRef}
          className="h-full w-full"
          backgroundColor={RenderConfig.background}
          antialias={true}
          autoDensity={true}
          resolution={window.devicePixelRatio}
        >
          <Viewport worldBounds={worldBounds} initialTarget={initialTarget}>
            <MapRenderer
              worldBounds={worldBounds}
              grid={grid}
              selection={selection}
              splitMoveSelection={splitMoveSelection}
              moveQueue={moveQueue}
              onCellClick={onSelectCell}
              onSplitMoveCell={onArmSplitMove}
              playerColors={playerColors}
              pings={pings}
            />
          </Viewport>
        </Application>
      )}
    </div>
  );
}
