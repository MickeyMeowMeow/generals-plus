import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";

import {
  pingAttackIcon,
  pingDefenseIcon,
  pingRallyIcon,
} from "#/features/game/assets";
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

const pingIcons: Record<string, string> = {
  attack: pingAttackIcon,
  defense: pingDefenseIcon,
  rally: pingRallyIcon,
};

export function PingLayer({ grid, pings }: PingLayerProps) {
  return (
    <pixiContainer>
      {pings.map((ping) => {
        const size = RenderConfig.cellStride * 0.38;

        const cellCoord = grid.toCartesian(ping);
        const x = (cellCoord.x + 0.28) * RenderConfig.cellStride;
        const y = (cellCoord.y - 0.28) * RenderConfig.cellStride;

        const icon = pingIcons[ping.type] || pingIcons.rally;
        const texture = Texture.from(icon);

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
