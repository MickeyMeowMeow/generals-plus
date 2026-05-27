import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";

import { RenderConfig } from "#/features/game/renderer/render-config";
import type { RenderGrid } from "#/features/game/renderer/render-grid";

extend({ Container, Sprite });

export interface Ping {
  id: string;
  x: number;
  y: number;
  type: string;
}

interface PingLayerProps {
  readonly grid: RenderGrid;
  readonly pings: Ping[];
}

const swordsSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
  <line x1="13" x2="19" y1="19" y2="13" />
  <line x1="16" x2="20" y1="16" y2="20" />
  <line x1="19" x2="21" y1="21" y2="19" />
  <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
  <line x1="5" x2="9" y1="14" y2="18" />
  <line x1="7" x2="4" y1="17" y2="20" />
  <line x1="3" x2="5" y1="19" y2="21" />
</svg>
`;

const shieldSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
</svg>
`;

const flagSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" />
</svg>
`;

const createSvgTexture = (svg: string) => {
  if (typeof window === "undefined") {
    return Texture.EMPTY;
  }
  const base64 = btoa(unescape(encodeURIComponent(svg.trim())));
  const img = new Image();
  img.src = `data:image/svg+xml;base64,${base64}`;
  return Texture.from(img);
};

const textures: Record<string, Texture> = {
  attack: createSvgTexture(swordsSvg),
  defense: createSvgTexture(shieldSvg),
  rally: createSvgTexture(flagSvg),
};

export function PingLayer({ grid, pings }: PingLayerProps) {
  return (
    <pixiContainer>
      {pings.map((ping) => {
        const size = RenderConfig.cellStride * 0.38;

        const cellCoord = grid.toCartesian(ping);
        const x = (cellCoord.x + 0.28) * RenderConfig.cellStride;
        const y = (cellCoord.y - 0.28) * RenderConfig.cellStride;

        const texture = textures[ping.type] || textures.rally;

        return (
          <pixiSprite
            key={ping.id}
            texture={texture}
            anchor={0.5}
            x={x}
            y={y}
            width={size}
            height={size}
          />
        );
      })}
    </pixiContainer>
  );
}
