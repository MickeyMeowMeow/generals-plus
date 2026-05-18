// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimerBar } from "#/features/game/components/timer-bar";

describe("TimerBar Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the custom label and calculated time correctly", () => {
    render(
      <TimerBar
        currentTick={0}
        targetTick={100}
        tickInterval={1000} // 1 tick = 1 second
        label="Phase ends in"
      />,
    );

    // 100 ticks * 1000ms = 100 seconds = 1:40
    expect(screen.getByText("Phase ends in")).toBeDefined();
    expect(screen.getByText("1:40")).toBeDefined();
  });

  it("applies 'normal' color styling when time > 30s", () => {
    render(
      <TimerBar
        currentTick={50}
        targetTick={100}
        tickInterval={1000} // 50 seconds remaining
      />,
    );

    const timeText = screen.getByText("0:50");
    expect(timeText.className).toContain("text-timer-normal");
  });

  it("applies 'warning' color styling when time <= 30s and > 10s", () => {
    render(
      <TimerBar
        currentTick={70}
        targetTick={100}
        tickInterval={1000} // 30 seconds remaining
      />,
    );

    const timeText = screen.getByText("0:30");
    expect(timeText.className).toContain("text-timer-warning");
  });

  it("applies 'critical' color styling when time <= 10s", () => {
    render(
      <TimerBar
        currentTick={95}
        targetTick={100}
        tickInterval={1000} // 5 seconds remaining
      />,
    );

    const timeText = screen.getByText("0:05");
    expect(timeText.className).toContain("text-timer-critical");
  });

  it("caps remaining time at zero when currentTick exceeds targetTick", () => {
    render(<TimerBar currentTick={110} targetTick={100} tickInterval={1000} />);

    // Should not show negative time
    expect(screen.getByText("0:00")).toBeDefined();
  });
});
