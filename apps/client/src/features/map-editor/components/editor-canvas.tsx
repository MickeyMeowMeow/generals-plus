import type { ICoordinate } from "@generals-plus/engine";
import { GridType, Visibility } from "@generals-plus/engine";
import type { CellTemplate, SpawnPoint } from "@generals-plus/shared-types";
import { Application, extend } from "@pixi/react";
import type { FederatedPointerEvent } from "pixi.js";
import {
  Assets,
  Container,
  Graphics,
  Rectangle,
  Text,
  TextStyle,
} from "pixi.js";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cityIcon,
  crownIcon,
  desertIcon,
  flagIcon,
  mountainIcon,
  swampIcon,
} from "#/features/game/assets";
import { GridLayer } from "#/features/game/renderer/layers/grid";
import { IconLayer } from "#/features/game/renderer/layers/icon";
import { PayloadLayer } from "#/features/game/renderer/layers/payload";
import { SiteLabelLayer } from "#/features/game/renderer/layers/site-label";
import { TroopLayer } from "#/features/game/renderer/layers/troop";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import {
  HexRenderGrid,
  SquareRenderGrid,
} from "#/features/game/renderer/render-grid";
import { Viewport } from "#/features/game/renderer/viewport";
import { useEditorStore } from "#/features/map-editor/store/editor-store";

extend({ Container, Graphics, Text });

const SPAWN_TEXT_STYLE = new TextStyle({
  fontFamily: "Oxanium Variable, sans-serif",
  fontSize: 22,
  fill: 0xffffff,
  stroke: { color: 0x111111, width: 4 },
  fontWeight: "900",
});

function buildRenderGrid(
  gridType: GridType,
  bounds: { width?: number; height?: number } & {
    left?: number;
    right?: number;
    leftSlant?: number;
    rightSlant?: number;
  },
  cells: CellTemplate[][],
  spawns: SpawnPoint[],
  _playerColorByTeam: Map<string, number>,
): RenderGrid {
  const spawnByCoord = new Map<string, SpawnPoint>();
  for (const s of spawns) {
    spawnByCoord.set(`${s.x},${s.y}`, s);
  }

  const buildCell = (cellTpl: CellTemplate, coord: ICoordinate) => {
    const spawn = spawnByCoord.get(`${coord.x},${coord.y}`);
    const ownerIndex = spawn ? spawn.teamId : null;
    return {
      coordinate: coord,
      visibility: Visibility.VISIBLE,
      terrain: cellTpl.terrain,
      troopCount: cellTpl.troopCount,
      ownerIndex,
      siteIndex: cellTpl.siteIndex,
      zoneIndex: cellTpl.zoneIndex,
      item: null,
    };
  };

  if (gridType === GridType.SQUARE) {
    const width = bounds.width ?? 0;
    const height = bounds.height ?? 0;
    return SquareRenderGrid.fromArray<
      CellTemplate,
      ReturnType<typeof buildCell>
    >(width, height, cells.flat(), buildCell);
  }

  const { left, right, leftSlant, rightSlant } = bounds as {
    left: number;
    right: number;
    leftSlant: number;
    rightSlant: number;
  };
  return HexRenderGrid.fromArray<CellTemplate, ReturnType<typeof buildCell>>(
    left,
    right,
    leftSlant,
    rightSlant,
    cells.flat(),
    buildCell,
  );
}

interface EditorCanvasProps {
  /** Player palette: teamId → color (used to tint generals on the canvas) */
  playerColorByTeam: Map<string, number>;
}

interface EditorSpawnLayerProps {
  grid: RenderGrid;
  spawns: SpawnPoint[];
}

// Memoized to prevent Pixi display object reconciliation flickering on mouse move
const EditorSpawnLayer = memo(function EditorSpawnLayer({
  grid,
  spawns,
}: EditorSpawnLayerProps) {
  const drawSpawns = useCallback(
    (g: Graphics) => {
      g.clear();
      // Draw small ring for each spawn
      for (const s of spawns) {
        const c = grid.toCartesian({ x: s.x, y: s.y });
        const x = c.x * RenderConfig.cellStride;
        const y = c.y * RenderConfig.cellStride;
        g.circle(x, y, RenderConfig.cellStride * 0.4);
        g.stroke({ width: 3, color: 0xffffff, alpha: 0.85 });
      }
    },
    [grid, spawns],
  );

  return (
    <pixiContainer>
      <pixiGraphics draw={drawSpawns} />
      {spawns.map((s) => {
        const c = grid.toCartesian({ x: s.x, y: s.y });
        const x = c.x * RenderConfig.cellStride;
        const y =
          c.y * RenderConfig.cellStride + RenderConfig.cellStride * 0.45;
        const text = `${s.teamId}/${s.slot}`;
        return (
          <pixiText
            key={`spawn-label-${s.x},${s.y}`}
            text={text}
            anchor={0.5}
            x={x}
            y={y}
            style={SPAWN_TEXT_STYLE}
          />
        );
      })}
    </pixiContainer>
  );
});

// Memoized to completely isolate Pixi sublayers from parent re-renders when mouse moves/drags
const EditorScene = memo(function EditorScene({
  grid,
  spawns,
  track,
  playerColorByTeam,
  onCellClick,
}: {
  grid: RenderGrid;
  spawns: SpawnPoint[];
  track: ICoordinate[];
  playerColorByTeam: Map<string, number>;
  onCellClick: (coord: ICoordinate) => void;
}) {
  const hitArea = useMemo(() => {
    if (grid.gridType === GridType.SQUARE) {
      return new Rectangle(
        -0.5 * RenderConfig.cellStride,
        -0.5 * RenderConfig.cellStride,
        (grid.bounds.width + 0.5) * RenderConfig.cellStride,
        (grid.bounds.height + 0.5) * RenderConfig.cellStride,
      );
    }
    return new Rectangle(-10000, -10000, 20000, 20000);
  }, [grid]);

  const onPointerDown = useCallback(
    (e: FederatedPointerEvent) => {
      const localPos = e.currentTarget.toLocal(e.global);
      const coord = grid.fromCartesian({
        x: localPos.x / RenderConfig.cellStride,
        y: localPos.y / RenderConfig.cellStride,
      });
      if (coord) onCellClick(coord);
    },
    [grid, onCellClick],
  );

  const payloadTrackX = useMemo(() => track.map((t) => t.x), [track]);
  const payloadTrackY = useMemo(() => track.map((t) => t.y), [track]);

  return (
    <pixiContainer
      eventMode="static"
      hitArea={hitArea}
      onPointerDown={onPointerDown}
    >
      {/* 1. Base cell rendering with correct player colors */}
      <GridLayer
        tick={0}
        grid={grid}
        playerColors={playerColorByTeam}
        isEditor={true}
      />

      {/* 2. Terrain icons (Mountain, Swamp, Desert, City, Flag, Crown/General) */}
      <IconLayer tick={0} grid={grid} />

      {/* 3. Payload railroad route track */}
      {payloadTrackX.length > 0 && (
        <PayloadLayer
          grid={grid}
          payloadTrackX={payloadTrackX}
          payloadTrackY={payloadTrackY}
          cartIndex={-1}
          cartSize={0}
        />
      )}

      {/* 4. Demolition bomb site labels (A, B, C...) */}
      <SiteLabelLayer grid={grid} />

      {/* 5. City and cell troop numbers */}
      <TroopLayer tick={0} grid={grid} splitMoveSelection={null} />

      {/* 6. Editor-specific player general spawn points & rings */}
      <EditorSpawnLayer grid={grid} spawns={spawns} />
    </pixiContainer>
  );
});

export const EditorCanvas = memo(function EditorCanvas({
  playerColorByTeam,
}: EditorCanvasProps) {
  const gridType = useEditorStore((s) => s.gridType);
  const bounds = useEditorStore((s) => s.bounds);
  const cells = useEditorStore((s) => s.cells);
  const spawns = useEditorStore((s) => s.spawns);
  const track = useEditorStore((s) => s.track);
  const paintCell = useEditorStore((s) => s.paintCell);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const grid = useMemo(
    () => buildRenderGrid(gridType, bounds, cells, spawns, playerColorByTeam),
    [gridType, bounds, cells, spawns, playerColorByTeam],
  );

  const worldBounds = useMemo(() => {
    if (gridType === GridType.SQUARE) {
      const { width, height } = bounds as { width: number; height: number };
      return {
        left: -0.5 * RenderConfig.cellStride,
        right: (width - 0.5) * RenderConfig.cellStride,
        top: -0.5 * RenderConfig.cellStride,
        bottom: (height - 0.5) * RenderConfig.cellStride,
      };
    }
    const b = bounds as {
      left: number;
      right: number;
      leftSlant: number;
      rightSlant: number;
    };
    return {
      left: -(b.left - 1 / 3) * RenderConfig.cellStride,
      right: (b.right - 1 / 3) * RenderConfig.cellStride,
      top: (-Math.sqrt(3) * RenderConfig.cellStride) / 3,
      bottom:
        (Math.max(b.leftSlant, b.rightSlant) / 1.5 - 1 / 3) *
        Math.sqrt(3) *
        RenderConfig.cellStride,
    };
  }, [gridType, bounds]);

  useEffect(() => {
    Assets.load([
      cityIcon,
      crownIcon,
      desertIcon,
      flagIcon,
      mountainIcon,
      swampIcon,
    ])
      .then(() => setIsReady(true))
      .catch(() => setIsReady(true));
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      {!isReady ? (
        <div className="grid h-full place-items-center text-sm text-game-text-dim">
          Loading editor
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
          <Viewport worldBounds={worldBounds}>
            <EditorScene
              grid={grid}
              spawns={spawns}
              track={track}
              playerColorByTeam={playerColorByTeam}
              onCellClick={paintCell}
            />
          </Viewport>
        </Application>
      )}
    </div>
  );
});

export default EditorCanvas;
