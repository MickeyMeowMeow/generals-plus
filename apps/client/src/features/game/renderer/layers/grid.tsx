import { Terrain, Visibility } from "@generals-plus/engine";
import { extend } from "@pixi/react";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";
import {
  NeutralTroopCellColor,
  TerrainTheme,
} from "#/features/game/renderer/theme.ts";
import { drawCell } from "#/features/game/utils/renderer";

extend({ Container });

interface GridLayerProps {
  tick: number;
  grid: RenderGrid;
  playerColors: Map<string, number>;
}

export function getCellFillColor(
  cell: RenderGridCell,
  playerColors: Map<string, number>,
) {
  if (
    cell.visibility === Visibility.SHROUDED &&
    cell.terrain === Terrain.BOMB_SITE
  ) {
    return 0x525356;
  }

  if (cell.ownerIndex) {
    return playerColors.get(cell.ownerIndex) ?? 0x333333;
  }

  if (cell.visibility === Visibility.SHROUDED) {
    return 0x525356;
  }

  if ((cell.troopCount ?? 0) > 0) {
    return NeutralTroopCellColor;
  }

  return TerrainTheme[cell.terrain]?.color || 0xffffff;
}

const CHUNK_SIZE = 16;

export function GridLayer({ tick, grid, playerColors }: GridLayerProps) {
  const containerRef = useRef<Container>(null);

  // Maintains a cache of Graphics objects mapped to 16x16 geographical chunks
  const chunksRef = useRef<Map<string, { g: Graphics; signature: string }>>(
    new Map(),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is intentionally included to force a refresh each tick, since cell ownership changes frequently
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chunks = chunksRef.current;
    const cellsByChunk = new Map<string, RenderGridCell[]>();
    const signaturePartsByChunk = new Map<string, string[]>();

    // Group cells by spatial chunk and compute a fast comparison signature
    for (const cell of grid) {
      const cx = Math.floor(cell.coordinate.x / CHUNK_SIZE);
      const cy = Math.floor(cell.coordinate.y / CHUNK_SIZE);
      const key = `${cx},${cy}`;

      let chunkCells = cellsByChunk.get(key);
      if (!chunkCells) {
        chunkCells = [];
        cellsByChunk.set(key, chunkCells);
      }
      chunkCells.push(cell);

      let signatureParts = signaturePartsByChunk.get(key);
      if (!signatureParts) {
        signatureParts = [];
        signaturePartsByChunk.set(key, signatureParts);
      }

      const color = getCellFillColor(cell, playerColors);
      const collapse = cell.willCollapse ? 1 : 0;

      signatureParts.push(`${color}-${collapse}`);
    }

    // Diff and redraw only the chunks whose visual signature has changed
    for (const [key, cells] of cellsByChunk.entries()) {
      const newSignature = signaturePartsByChunk.get(key)?.join("|") || "";
      let chunk = chunks.get(key);

      if (!chunk) {
        const g = new Graphics();
        container.addChild(g);
        chunk = { g, signature: "" };
        chunks.set(key, chunk);
      }

      if (chunk.signature !== newSignature) {
        chunk.g.clear();

        for (const cell of cells) {
          drawCell(chunk.g, grid, cell.coordinate);
          chunk.g.stroke({
            width: RenderConfig.cellStroke,
            color: RenderConfig.background,
          });

          chunk.g.fill(getCellFillColor(cell, playerColors));

          if (cell.willCollapse) {
            drawCell(chunk.g, grid, cell.coordinate);
            chunk.g.fill({ color: 0x7c3aed, alpha: 0.26 });
            chunk.g.stroke({ width: 2, color: 0xd946ef, alignment: 0.5 });
          }
        }
        chunk.signature = newSignature;
      }
    }

    // Garbage collect chunks that are no longer part of the map
    for (const [key, chunk] of chunks.entries()) {
      if (!cellsByChunk.has(key)) {
        container.removeChild(chunk.g);
        chunk.g.destroy();
        chunks.delete(key);
      }
    }
  }, [tick, grid, playerColors]);

  return <pixiContainer ref={containerRef} />;
}
