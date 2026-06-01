import { describe, expect, it } from "vitest";

import {
  MOTION_DURATION,
  MOTION_EASING,
  MOTION_LAYOUT_TRANSITION,
} from "#/features/motion/motion-tokens";

describe("MOTION_LAYOUT_TRANSITION", () => {
  it("uses the normal duration and enter easing", () => {
    expect(MOTION_LAYOUT_TRANSITION).toEqual({
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASING.enter,
    });
  });
});
