// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge } from "#/components/feedback/status-badge";

describe("StatusBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders status text by default", () => {
    render(<StatusBadge status="idle" />);
    expect(screen.getByText("idle")).toBeTruthy();
  });

  it("renders custom label when provided", () => {
    render(<StatusBadge status="idle" label="Offline" />);
    expect(screen.getByText("Offline")).toBeTruthy();
  });

  it("applies default variant for authenticated status", () => {
    render(<StatusBadge status="authenticated" />);
    const badge = screen.getByText("authenticated");
    expect(badge.dataset.variant).toBe("default");
  });

  it("applies secondary variant for authenticating status", () => {
    render(<StatusBadge status="authenticating" />);
    const badge = screen.getByText("authenticating");
    expect(badge.dataset.variant).toBe("secondary");
  });

  it("applies destructive variant for error status", () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByText("error");
    expect(badge.dataset.variant).toBe("destructive");
  });

  it("applies outline variant for idle status", () => {
    render(<StatusBadge status="idle" />);
    const badge = screen.getByText("idle");
    expect(badge.dataset.variant).toBe("outline");
  });
});
