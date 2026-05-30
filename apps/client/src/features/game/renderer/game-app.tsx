import type { ICoordinate } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";
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
import {
  ClearMoveQueueKey,
  KeyToDirection,
  KeyToPing,
  SplitMoveModifier,
} from "#/features/game/utils/hotkey";
import type { MoveDirection, MoveIntent } from "#/features/game/utils/move";

interface GameAppProps {
  /** Grid snapshot to render. */
  readonly tick: number;
  readonly grid: RenderGrid;
  readonly initialCoord?: ICoordinate;
  readonly selection: ICoordinate | null;
  readonly isSplitMove: boolean;
  readonly moveQueue: MoveIntent[];
  readonly bombMoveSignal: boolean;
  readonly onSelectCell: (coord: ICoordinate) => void;
  readonly onToggleStickySplitMove: () => void;
  readonly onUpdateActiveSplitMove: (value: boolean) => void;
  readonly onQueueMove: (direction: MoveDirection) => void;
  readonly onClearMoveQueue: () => void;
  readonly onPing: (
    coord: ICoordinate,
    type: "attack" | "defense" | "rally",
  ) => void;
  readonly playerColors: Map<string, number>;
  readonly pings: Ping[];
  readonly isPlanted?: boolean;
  readonly ticksRemaining?: number;
  readonly payloadTrackX?: number[];
  readonly payloadTrackY?: number[];
  readonly cartIndex?: number;
  readonly cartSize?: number;
}

/**
 * Pixi match canvas sized by its parent container.
 *
 * The renderer keeps input logic in Pixi while React owns HUD and result UI
 * around it, allowing the game page to use the full browser viewport.
 */
export function GameApp({
  tick,
  grid,
  initialCoord,
  selection,
  isSplitMove,
  moveQueue,
  bombMoveSignal,
  onSelectCell,
  onToggleStickySplitMove,
  onUpdateActiveSplitMove,
  onQueueMove,
  onClearMoveQueue,
  onPing,
  playerColors,
  pings,
  isPlanted = false,
  ticksRemaining = -1,
  payloadTrackX = [],
  payloadTrackY = [],
  cartIndex = -1,
  cartSize = 0,
}: GameAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const pointerRef = useRef({ x: 0, y: 0 });

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
          left: -(grid.bounds.left - 1 / 3) * RenderConfig.cellStride,
          right: (grid.bounds.right - 1 / 3) * RenderConfig.cellStride,
          top: (-Math.sqrt(3) * RenderConfig.cellStride) / 3,
          bottom:
            (Math.max(grid.bounds.leftSlant, grid.bounds.rightSlant) / 1.5 -
              1 / 3) *
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
      if (e.code === ClearMoveQueueKey) {
        e.preventDefault();
        onClearMoveQueue();
        return;
      }

      if (KeyToPing[e.code]) {
        e.preventDefault();
        const coord = grid?.fromCartesian({
          x: pointerRef.current.x / RenderConfig.cellStride,
          y: pointerRef.current.y / RenderConfig.cellStride,
        });
        if (coord) {
          onPing(coord, KeyToPing[e.code]);
        }
        return;
      }

      if (e.getModifierState(SplitMoveModifier)) {
        onUpdateActiveSplitMove(true);
      }
      if (KeyToDirection[grid.gridType][e.code]) {
        e.preventDefault();
        onQueueMove(KeyToDirection[grid.gridType][e.code]);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.getModifierState(SplitMoveModifier)) {
        onUpdateActiveSplitMove(false);
      }
    };

    const handleWindowBlur = () => {
      onUpdateActiveSplitMove(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    grid.gridType,
    grid.fromCartesian,
    onUpdateActiveSplitMove,
    onClearMoveQueue,
    onQueueMove,
    onPing,
  ]);

  const initialTarget = useMemo(() => {
    if (initialCoord) {
      const { x, y } = grid.toCartesian(initialCoord);
      return { x: x * RenderConfig.cellStride, y: y * RenderConfig.cellStride };
    }
  }, [grid, initialCoord]);

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
              tick={tick}
              worldBounds={worldBounds}
              grid={grid}
              selection={selection}
              isSplitMove={isSplitMove}
              moveQueue={moveQueue}
              pointerRef={pointerRef}
              bombMoveSignal={bombMoveSignal}
              onCellClick={onSelectCell}
              onToggleStickySplitMove={onToggleStickySplitMove}
              playerColors={playerColors}
              pings={pings}
              isPlanted={isPlanted}
              ticksRemaining={ticksRemaining}
              payloadTrackX={payloadTrackX}
              payloadTrackY={payloadTrackY}
              cartIndex={cartIndex}
              cartSize={cartSize}
            />
          </Viewport>
        </Application>
      )}
    </div>
  );
}
