import { SquareGrid2D, Terrain, Visibility } from "@generals-plus/engine";
import { describe, expect, it, vi } from "vitest";

import { getArrowAnchor } from "#/features/game/renderer/layers/move-queue-geometry";
import { RenderConfig } from "#/features/game/renderer/render-config";
import type { SquareRenderGrid } from "#/features/game/renderer/render-grid";
import { MoveDirection } from "#/features/game/utils/move";

const stride = vi.hoisted(() => 100);
const from = { x: 2, y: 3 };

vi.mock("#/features/game/renderer/render-config", () => ({
  RenderConfig: {
    cellStride: stride,
    arrowEdgeInset: 1,
    arrowLength: 35,
  },
}));

function expectedTipInset() {
  return RenderConfig.arrowEdgeInset + RenderConfig.arrowLength / 2;
}

describe("MoveQueueLayer", () => {
  const grid: SquareRenderGrid = SquareGrid2D.generate(10, 10, () => ({
    coordinate: { x: 0, y: 0 },
    visibility: Visibility.VISIBLE,
    terrain: Terrain.PLAIN,
    troopCount: null,
    ownerIndex: null,
  }));

  it("places right move arrows fully inside the departure cell", () => {
    const anchor = getArrowAnchor(grid, {
      from,
      direction: MoveDirection.RIGHT,
    });

    expect(anchor).toEqual({
      anchorX: (from.x + 0.5) * stride - expectedTipInset(),
      anchorY: from.y * stride,
    });
  });

  it("places directional arrow anchors away from the target cell edge", () => {
    expect(
      getArrowAnchor(grid, { from, direction: MoveDirection.LEFT }),
    ).toEqual({
      anchorX: (from.x - 0.5) * stride + expectedTipInset(),
      anchorY: from.y * stride,
    });

    expect(getArrowAnchor(grid, { from, direction: MoveDirection.UP })).toEqual(
      {
        anchorX: from.x * stride,
        anchorY: (from.y - 0.5) * stride + expectedTipInset(),
      },
    );

    expect(
      getArrowAnchor(grid, { from, direction: MoveDirection.DOWN }),
    ).toEqual({
      anchorX: from.x * stride,
      anchorY: (from.y + 0.5) * stride - expectedTipInset(),
    });
  });
});
