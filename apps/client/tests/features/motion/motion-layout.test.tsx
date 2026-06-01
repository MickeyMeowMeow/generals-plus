import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MotionLayout } from "#/features/motion/components/motion-layout";
import { MotionProvider } from "#/features/motion/motion-provider";

function renderWithMotion(ui: React.ReactElement, mode?: "full" | "reduced") {
  return render(
    <MotionProvider preferenceMode={mode ?? "full"}>{ui}</MotionProvider>,
  );
}

/** Returns the MotionLayout element (second child down from the render container). */
function getLayoutEl(container: HTMLElement): HTMLElement {
  // MotionProvider wraps in a <div data-motion="…">, MotionLayout is inside it.
  return container.firstElementChild?.firstElementChild as HTMLElement;
}

describe("MotionLayout", () => {
  it("renders content when motion is enabled", () => {
    const { container } = renderWithMotion(
      <MotionLayout className="test-class">content</MotionLayout>,
      "full",
    );

    const el = getLayoutEl(container);
    expect(el).toBeTruthy();
    expect(el.tagName).toBe("DIV");
    expect(el.textContent).toBe("content");
  });

  it("renders a plain div when reduced motion is preferred", () => {
    const { container } = renderWithMotion(
      <MotionLayout className="test-class">content</MotionLayout>,
      "reduced",
    );

    const el = getLayoutEl(container);
    expect(el).toBeTruthy();
    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("style")).toBeNull();
    expect(el.textContent).toBe("content");
  });

  it("passes className through", () => {
    const { container } = renderWithMotion(
      <MotionLayout className="my-class">x</MotionLayout>,
    );

    const el = getLayoutEl(container);
    expect(el.classList.contains("my-class")).toBe(true);
  });
});
