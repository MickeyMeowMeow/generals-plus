import { describe, expect, it } from "vitest";

import { formatTime } from "#/lib/utils";

describe("formatTime", () => {
  it("formats zero correctly", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(45)).toBe("0:45");
  });

  it("formats exactly one minute", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("formats minutes and seconds correctly", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(125)).toBe("2:05");
    expect(formatTime(605)).toBe("10:05");
  });

  it("handles negative numbers safely by treating them as zero", () => {
    expect(formatTime(-10)).toBe("0:00");
  });
});
