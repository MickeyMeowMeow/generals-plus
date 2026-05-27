import { extend } from "@pixi/react";
import { Container, Sprite, Texture } from "pixi.js";

import {
  pingAttackIcon,
  pingDefenseIcon,
  pingRallyIcon,
} from "#/features/game/assets";
import { RenderConfig } from "#/features/game/renderer/render-config.ts";

extend({ Container, Sprite });

export interface Ping {
  id: string;
  x: number;
  y: number;
  type: string;
}

interface PingLayerProps {
  readonly pings: Ping[];
  readonly stride: number;
}

const pingIcons: Record<string, string> = {
  attack: pingAttackIcon,
  defense: pingDefenseIcon,
  rally: pingRallyIcon,
};

export function PingLayer({ pings, stride }: PingLayerProps) {
  const cellSize = stride - RenderConfig.cellGap;

  return (
    <pixiContainer>
      {pings.map((ping) => {
        const size = cellSize * 0.38;
        const x = ping.x * stride + cellSize * 0.78;
        const y = ping.y * stride + cellSize * 0.22;
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
