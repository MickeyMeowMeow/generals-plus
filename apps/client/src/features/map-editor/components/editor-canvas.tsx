import type { ICoordinate } from "@generals-plus/engine";
import {
  GridType,
  HexGrid2D,
  Terrain,
  Visibility,
} from "@generals-plus/engine";
import type { CellTemplate, SpawnPoint } from "@generals-plus/shared-types";
import { Application, extend } from "@pixi/react";
import type { FederatedPointerEvent } from "pixi.js";
import { Assets, Container, Graphics, Rectangle, Text } from "pixi.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cityIcon,
  crownIcon,
  desertIcon,
  flagIcon,
  mountainIcon,
  swampIcon,
} from "#/features/game/assets";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import {
  HexRenderGrid,
  SquareRenderGrid,
} from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme";
import { Viewport } from "#/features/game/renderer/viewport";
import { drawCell } from "#/features/game/utils/renderer";
import { useEditorStore } from "#/features/map-editor/store/editor-store";

extend({ Container, Graphics, Text });

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

function EditorScene({
  grid,
  spawns,
  track,
  cells,
  playerColorByTeam,
  onCellClick,
}: {
  grid: RenderGrid;
  spawns: SpawnPoint[];
  track: ICoordinate[];
  cells: CellTemplate[][];
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

  const drawBase = useCallback(
    (g: Graphics) => {
      g.clear();
      grid.forEach((cell, coord) => {
        drawCell(g, grid, coord);
        const theme = TerrainTheme[cell.terrain];
        let color = theme?.color ?? 0xffffff;
        if (cell.ownerIndex) {
          color = playerColorByTeam.get(cell.ownerIndex) ?? color;
        }
        g.stroke({
          width: RenderConfig.cellStroke,
          color: RenderConfig.background,
        });
        g.fill(color);
      });
    },
    [grid, playerColorByTeam],
  );

  const drawTrack = useCallback(
    (g: Graphics) => {
      g.clear();
      if (track.length === 0) return;
      for (let i = 0; i < track.length; i++) {
        const p = track[i];
        const c = grid.toCartesian(p);
        const x = c.x * RenderConfig.cellStride;
        const y = c.y * RenderConfig.cellStride;
        g.circle(x, y, RenderConfig.cellStride * 0.15);
        g.fill({ color: 0x3498db, alpha: 0.85 });
        if (i > 0) {
          const prev = grid.toCartesian(track[i - 1]);
          g.moveTo(
            prev.x * RenderConfig.cellStride,
            prev.y * RenderConfig.cellStride,
          );
          g.lineTo(x, y);
          g.stroke({ width: 8, color: 0x3498db, alpha: 0.5 });
        }
      }
    },
    [grid, track],
  );

  const drawSpawnLabels = useCallback(
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

  // Render bombsite labels and general icons via Text elements
  const labels = useMemo(() => {
    const items: {
      x: number;
      y: number;
      text: string;
      kind: "bomb" | "spawn";
    }[] = [];
    for (let y = 0; y < cells.length; y++) {
      for (let x = 0; x < cells[y].length; x++) {
        const cell = cells[y][x];
        const offset =
          grid.gridType === GridType.HEX
            ? HexGrid2D.getMinX(y, (grid as HexRenderGrid).bounds.left)
            : 0;
        const realX = offset + x;
        if (cell.terrain === Terrain.BOMB_SITE && cell.siteIndex !== null) {
          const c = grid.toCartesian({ x: realX, y });
          items.push({
            x: c.x * RenderConfig.cellStride,
            y: c.y * RenderConfig.cellStride,
            text: String.fromCharCode(65 + cell.siteIndex),
            kind: "bomb",
          });
        }
      }
    }
    for (const s of spawns) {
      const c = grid.toCartesian({ x: s.x, y: s.y });
      items.push({
        x: c.x * RenderConfig.cellStride,
        y: c.y * RenderConfig.cellStride + RenderConfig.cellStride * 0.45,
        text: `${s.teamId}/${s.slot}`,
        kind: "spawn",
      });
    }
    return items;
  }, [cells, spawns, grid]);

  return (
    <pixiContainer
      eventMode="static"
      hitArea={hitArea}
      onPointerDown={onPointerDown}
    >
      <pixiGraphics draw={drawBase} />
      <pixiGraphics draw={drawTrack} />
      <pixiGraphics draw={drawSpawnLabels} />
      {labels.map((l) => (
        <pixiText
          key={`${l.kind}-${l.x.toFixed(1)}-${l.y.toFixed(1)}-${l.text}`}
          text={l.text}
          x={l.x}
          y={l.y}
          anchor={0.5}
          style={{
            fontFamily: "Oxanium Variable, sans-serif",
            fontSize: l.kind === "bomb" ? 60 : 22,
            fill: 0xffffff,
            stroke: { color: 0x111111, width: 4 },
            fontWeight: "900",
          }}
        />
      ))}
    </pixiContainer>
  );
}

export function EditorCanvas({ playerColorByTeam }: EditorCanvasProps) {
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
    <div ref={containerRef} className="h-full w-full">
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
              cells={cells}
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
}
