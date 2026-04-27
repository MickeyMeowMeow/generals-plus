// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ErrorAlert } from "#/components/feedback/error-alert";

describe("ErrorAlert", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders error message when provided", () => {
    render(<ErrorAlert message="Network error" />);
    expect(screen.getByRole("alert").textContent).toBe("Network error");
  });

  it("renders nothing when message is null", () => {
    const { container } = render(<ErrorAlert message={null} />);
    expect(container.innerHTML).toBe("");
  });
});
