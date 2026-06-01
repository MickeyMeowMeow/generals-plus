import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MotionProvider,
  useMotionPreference,
} from "#/features/motion/motion-provider";

function Probe() {
  const { mode, shouldReduceMotion } = useMotionPreference();

  return (
    <div>
      <span>{mode}</span>
      <span>{String(shouldReduceMotion)}</span>
    </div>
  );
}

describe("MotionProvider", () => {
  it("prefers the explicit user override over the system setting", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    render(
      <MotionProvider preferenceMode="full">
        <Probe />
      </MotionProvider>,
    );

    expect(screen.getByText("full")).toBeTruthy();
    expect(screen.getByText("false")).toBeTruthy();
  });
});
