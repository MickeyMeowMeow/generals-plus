// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm, AuthFormMode } from "#/features/auth/components/auth-form";

const defaultProps = {
  mode: AuthFormMode.SIGN_IN,
  onModeChange: vi.fn(),
  isBusy: false,
  lastError: null,
  onSignIn: vi.fn().mockResolvedValue(undefined),
  onRegister: vi.fn().mockResolvedValue(undefined),
  onGuestSignIn: vi.fn().mockResolvedValue(undefined),
};

describe("AuthForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders sign-in mode by default", () => {
    render(<AuthForm {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("renders registration fields when in register mode", () => {
    render(<AuthForm {...defaultProps} mode={AuthFormMode.REGISTER} />);

    expect(
      screen.getByRole("heading", { name: "Create account" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("calls onModeChange when switching modes", async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    render(<AuthForm {...defaultProps} onModeChange={onModeChange} />);

    await user.click(screen.getByRole("tab", { name: "Register" }));

    expect(onModeChange).toHaveBeenCalledWith(AuthFormMode.REGISTER);
  });

  it("disables mode switch controls while busy", () => {
    render(<AuthForm {...defaultProps} isBusy={true} />);

    expect(
      (screen.getByRole("tab", { name: "Log in" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("tab", { name: "Register" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("submits sign-in values through react hook form", async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AuthForm {...defaultProps} onSignIn={onSignIn} />);

    await user.type(screen.getByLabelText("Email"), "nova@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSignIn).toHaveBeenCalledWith({
      email: "nova@example.com",
      password: "hunter22",
    });
  });

  it("submits registration values through react hook form", async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AuthForm
        {...defaultProps}
        mode={AuthFormMode.REGISTER}
        onRegister={onRegister}
      />,
    );

    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Nova");
    await user.type(screen.getByLabelText("Email"), "nova@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onRegister).toHaveBeenCalledWith({
      displayName: "Nova",
      email: "nova@example.com",
      password: "hunter22",
    });
  });

  it("renders and submits the guest entry form", async () => {
    const onGuestSignIn = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AuthForm
        {...defaultProps}
        mode={AuthFormMode.GUEST}
        onGuestSignIn={onGuestSignIn}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Continue as guest" }),
    ).toBeTruthy();

    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Nova");
    await user.click(screen.getByRole("button", { name: "Enter as guest" }));

    expect(onGuestSignIn).toHaveBeenCalledWith({
      displayName: "Nova",
    });
  });

  it("shows field-level validation errors", async () => {
    const user = userEvent.setup();
    render(<AuthForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Email cannot be empty.")).toBeTruthy();
    expect(screen.getByText("Password cannot be empty.")).toBeTruthy();
  });

  it("shows required validation for empty registration password", async () => {
    const user = userEvent.setup();
    render(<AuthForm {...defaultProps} mode={AuthFormMode.REGISTER} />);

    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Nova");
    await user.type(screen.getByLabelText("Email"), "nova@example.com");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Password cannot be empty.")).toBeTruthy();
  });

  it("disables primary actions when busy", () => {
    const { rerender } = render(<AuthForm {...defaultProps} isBusy={true} />);

    expect(
      (
        screen.getByRole("tab", {
          name: "Guest",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Signing in...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Signing in...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    rerender(
      <AuthForm {...defaultProps} mode={AuthFormMode.GUEST} isBusy={true} />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Entering...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("shows error message when provided", () => {
    render(<AuthForm {...defaultProps} lastError="Network error" />);
    expect(screen.getByRole("alert").textContent).toContain("Network error");
  });

  it("shows default guest display name", () => {
    render(<AuthForm {...defaultProps} mode={AuthFormMode.GUEST} />);
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");
  });

  it("does not leak Commander into sign-in email after switching back from register or guest", async () => {
    const user = userEvent.setup();

    function ControlledAuthForm() {
      const [mode, setMode] = useState<AuthFormMode>(AuthFormMode.SIGN_IN);
      return <AuthForm {...defaultProps} mode={mode} onModeChange={setMode} />;
    }

    render(<ControlledAuthForm />);

    await user.click(screen.getByRole("tab", { name: "Register" }));
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");

    await user.click(screen.getByRole("tab", { name: "Log in" }));
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");

    await user.click(screen.getByRole("tab", { name: "Guest" }));
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");

    await user.click(screen.getByRole("tab", { name: "Log in" }));
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  });

  it("preserves the display name draft across guest and register tab switches", async () => {
    const user = userEvent.setup();

    function ControlledAuthForm() {
      const [mode, setMode] = useState<AuthFormMode>(AuthFormMode.GUEST);
      return <AuthForm {...defaultProps} mode={mode} onModeChange={setMode} />;
    }

    render(<ControlledAuthForm />);

    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Nova");

    await user.click(screen.getByRole("tab", { name: "Log in" }));
    await user.click(screen.getByRole("tab", { name: "Guest" }));
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Nova");

    await user.click(screen.getByRole("tab", { name: "Register" }));
    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Nova");
  });

  it("preserves the email draft across sign-in and register tab switches", async () => {
    const user = userEvent.setup();

    function ControlledAuthForm() {
      const [mode, setMode] = useState<AuthFormMode>(AuthFormMode.SIGN_IN);
      return <AuthForm {...defaultProps} mode={mode} onModeChange={setMode} />;
    }

    render(<ControlledAuthForm />);

    await user.type(screen.getByLabelText("Email"), "nova@example.com");

    await user.click(screen.getByRole("tab", { name: "Register" }));
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "nova@example.com",
    );

    await user.click(screen.getByRole("tab", { name: "Log in" }));
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "nova@example.com",
    );
  });
});
