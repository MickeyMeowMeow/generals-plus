import type { ICoordinate } from "@generals-plus/engine";
import { Application } from "@pixi/react";
import { Assets } from "pixi.js";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  bombNormalIcon,
  bombPlantedIcon,
  pingAttackIcon,
  pingDefenseIcon,
  pingRallyIcon,
} from "#/features/game/assets";
import type { Ping } from "#/features/game/renderer/layers/ping";
import { MapRenderer } from "#/features/game/renderer/map-renderer";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme.ts";
import { Viewport } from "#/features/game/renderer/viewport";
import { getCoordWorldPosition } from "#/features/game/utils/coord";
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
  readonly isPlanted?: boolean;
  readonly ticksRemaining?: number;
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
  isPlanted = false,
  ticksRemaining = -1,
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

      // Also preload bomb and ping icons
      icons.push(
        bombNormalIcon,
        bombPlantedIcon,
        pingAttackIcon,
        pingDefenseIcon,
        pingRallyIcon,
      );

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
      if (KeyToDirection[key]) {
        e.preventDefault();
        onQueueMove(KeyToDirection[key]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onArmSplitMove, onClearMoveQueue, onQueueMove]);

  const initialTarget = useMemo(
    () =>
      initialCoord &&
      getCoordWorldPosition(
        initialCoord,
        RenderConfig.cellStride,
        RenderConfig.cellStride - RenderConfig.cellGap,
      ),
    [initialCoord],
  );

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
          <Viewport
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            initialTarget={initialTarget}
          >
            <MapRenderer
              grid={grid}
              stride={RenderConfig.cellStride}
              selection={selection}
              splitMoveSelection={splitMoveSelection}
              moveQueue={moveQueue}
              onCellClick={onSelectCell}
              onSplitMoveCell={onArmSplitMove}
              playerColors={playerColors}
              pings={pings}
              isPlanted={isPlanted}
              ticksRemaining={ticksRemaining}
            />
          </Viewport>
        </Application>
      )}
    </div>
  );
}
