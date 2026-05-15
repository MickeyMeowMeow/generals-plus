// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "#/features/auth/components/auth-form";

const defaultProps = {
  displayName: "Commander",
  onDisplayNameChange: vi.fn(),
  isBusy: false,
  lastError: null,
  onSignIn: vi.fn().mockImplementation((e) => e.preventDefault()),
};

describe("AuthForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders sign-in heading", () => {
    render(<AuthForm {...defaultProps} />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("renders display name input with provided value", () => {
    render(<AuthForm {...defaultProps} />);
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");
  });

  it("calls onSignIn on form submit", async () => {
    const onSignIn = vi.fn().mockImplementation((e) => e.preventDefault());
    const user = userEvent.setup();
    render(<AuthForm {...defaultProps} onSignIn={onSignIn} />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("disables submit button when busy", () => {
    render(<AuthForm {...defaultProps} isBusy={true} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Signing in...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("shows error message when provided", () => {
    render(<AuthForm {...defaultProps} lastError="Network error" />);
    expect(screen.getByRole("alert").textContent).toContain("Network error");
  });

  it("does not render session controls", () => {
    render(<AuthForm {...defaultProps} />);
    expect(screen.queryByRole("button", { name: "Enter war room" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("calls onDisplayNameChange when typing", async () => {
    const onDisplayNameChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AuthForm {...defaultProps} onDisplayNameChange={onDisplayNameChange} />,
    );

    const input = screen.getByLabelText("Display name");
    await user.type(input, "A");
    expect(onDisplayNameChange).toHaveBeenCalled();
  });
});
