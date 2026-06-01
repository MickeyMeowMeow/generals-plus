// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { AnimatedNumber } from "#/features/motion/components/animated-number";
import { MotionProvider } from "#/features/motion/motion-provider";

function renderWithMotion(ui: ReactElement, mode: "full" | "reduced" = "full") {
  return render(<MotionProvider preferenceMode={mode}>{ui}</MotionProvider>);
}

describe("AnimatedNumber", () => {
  it("animates only the changed digit when a value updates in place", () => {
    const { rerender, container } = renderWithMotion(
      <AnimatedNumber value="128" />,
    );

    rerender(
      <MotionProvider preferenceMode="full">
        <AnimatedNumber value="129" />
      </MotionProvider>,
    );

    expect(
      container.querySelectorAll("[data-roll-direction='up']"),
    ).toHaveLength(1);
    expect(screen.getByLabelText("129").textContent).toBe("129");
  });

  it("keeps digit cell wrappers stable across updates", () => {
    const { rerender } = renderWithMotion(<AnimatedNumber value="128" />);

    const rootBefore = screen.getByLabelText("128");
    const cellsBefore = rootBefore.querySelectorAll("[data-digit-cell='true']");
    expect(cellsBefore).toHaveLength(3);
    const lastCellBefore = cellsBefore.item(2);

    rerender(
      <MotionProvider preferenceMode="full">
        <AnimatedNumber value="129" />
      </MotionProvider>,
    );

    const rootAfter = screen.getByLabelText("129");
    const cellsAfter = rootAfter.querySelectorAll("[data-digit-cell='true']");
    expect(cellsAfter).toHaveLength(3);
    expect(cellsAfter.item(2)).toBe(lastCellBefore);
  });

  it("aligns digits from the right when a digit run grows", () => {
    const { rerender, container } = renderWithMotion(
      <AnimatedNumber value="9" />,
    );

    rerender(
      <MotionProvider preferenceMode="full">
        <AnimatedNumber value="10" />
      </MotionProvider>,
    );

    expect(screen.getByLabelText("10").textContent).toBe("10");
    expect(
      container.querySelectorAll("[data-roll-direction='up']"),
    ).toHaveLength(2);
  });

  it("keeps separators static for timer-style values", () => {
    renderWithMotion(<AnimatedNumber value="1:05" />);

    const root = screen.getByLabelText("1:05");
    expect(
      root.querySelectorAll("[data-animated-kind='separator']"),
    ).toHaveLength(1);
    expect(root.textContent).toBe("1:05");
  });

  it("rolls downward when the value decreases", () => {
    const { rerender, container } = renderWithMotion(
      <AnimatedNumber value="1:05" />,
    );

    rerender(
      <MotionProvider preferenceMode="full">
        <AnimatedNumber value="1:04" />
      </MotionProvider>,
    );

    expect(
      container.querySelector("[data-roll-direction='down']"),
    ).toBeTruthy();
  });

  it("disables rolling when reduced motion is enabled", () => {
    const { rerender, container } = renderWithMotion(
      <AnimatedNumber value="3 / 8" />,
      "reduced",
    );

    rerender(
      <MotionProvider preferenceMode="reduced">
        <AnimatedNumber value="4 / 8" />
      </MotionProvider>,
    );

    expect(container.querySelector("[data-roll-direction]")).toBeNull();
    expect(screen.getByLabelText("4 / 8").textContent).toBe("4 / 8");
  });
});
