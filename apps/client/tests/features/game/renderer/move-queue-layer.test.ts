import { describe, expect, it } from "vitest";

import { getArrowAnchor } from "#/features/game/renderer/layers/move-queue-geometry";
import { RenderConfig } from "#/features/game/renderer/render-config";
import { MoveDirection } from "#/features/game/utils/move";

const stride = 100;
const from = { x: 2, y: 3 };

function expectedTipInset() {
  return RenderConfig.arrowEdgeInset + RenderConfig.arrowLength / 2;
}

describe("MoveQueueLayer", () => {
  it("places right move arrows fully inside the departure cell", () => {
    const anchor = getArrowAnchor(
      { from, direction: MoveDirection.RIGHT },
      stride,
    );

    expect(anchor).toEqual({
      anchorX: (from.x + 1) * stride - expectedTipInset(),
      anchorY: from.y * stride + stride / 2,
    });
  });

  it("places directional arrow anchors away from the target cell edge", () => {
    expect(
      getArrowAnchor({ from, direction: MoveDirection.LEFT }, stride),
    ).toEqual({
      anchorX: from.x * stride + expectedTipInset(),
      anchorY: from.y * stride + stride / 2,
    });

    expect(
      getArrowAnchor({ from, direction: MoveDirection.UP }, stride),
    ).toEqual({
      anchorX: from.x * stride + stride / 2,
      anchorY: from.y * stride + expectedTipInset(),
    });

    expect(
      getArrowAnchor({ from, direction: MoveDirection.DOWN }, stride),
    ).toEqual({
      anchorX: from.x * stride + stride / 2,
      anchorY: (from.y + 1) * stride - expectedTipInset(),
    });
  });
});
