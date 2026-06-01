import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";
import { useEffect, useRef } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";
import { TerrainTheme } from "#/features/game/renderer/theme";

extend({ Container });

const ICON_SIZE = RenderConfig.cellStride * RenderConfig.terrainIconScale;

interface IconLayerProps {
  tick: number;
  grid: RenderGrid;
}

export function IconLayer({ tick, grid }: IconLayerProps) {
  const containerRef = useRef<Container>(null);
  // Persists PIXI sprites across ticks to bypass React reconciliation overhead
  const poolRef = useRef<Map<string, { sprite: Sprite; icon: string }>>(
    new Map(),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is intentionally included to force a refresh each tick, since terrain can change frequently (e.g. from SHROUDED to VISIBLE)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pool = poolRef.current;

    grid.forEach((cell) => {
      const icon = TerrainTheme[cell.terrain]?.icon;

      const key = `${cell.coordinate.x},${cell.coordinate.y}`;
      const entry = pool.get(key);

      if (!icon) {
        if (entry) {
          // Clean up sprite if terrain no longer has an icon
          container.removeChild(entry.sprite);
          entry.sprite.destroy();
          pool.delete(key);
        }
        return;
      }

      const texture = Texture.from(icon);

      if (!entry) {
        // Create new sprite only if it doesn't exist
        const { x, y } = grid.toCartesian(cell.coordinate);

        const sprite = new Sprite({
          texture,
          anchor: 0.5,
          width: ICON_SIZE,
          height: ICON_SIZE,
          x: x * RenderConfig.cellStride,
          y: y * RenderConfig.cellStride,
        });

        container.addChild(sprite);
        pool.set(key, { sprite, icon });
      } else if (entry.icon !== icon) {
        // Update texture only if the terrain/icon changed
        entry.sprite.texture = texture;
        entry.icon = icon;
      }
    });
  }, [tick, grid]);

  return <pixiContainer ref={containerRef} />;
}
