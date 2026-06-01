// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStatus } from "#/features/auth/auth-store";
import { createMockAuth } from "#tests/helpers/auth";
import { renderRoute } from "#tests/helpers/render";

describe("index route", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders sign-in form on root", () => {
    renderRoute("/", createMockAuth());

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Guest" })).toBeTruthy();
  });

  it("shows default guest display name in input", async () => {
    renderRoute("/", createMockAuth());

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Guest" }));

    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");
  });

  it("disables sign-in button while authenticating", () => {
    renderRoute("/", createMockAuth({ status: AuthStatus.AUTHENTICATING }));

    expect(screen.queryByText("Checking session...")).toBeNull();
    expect(screen.getByRole("button", { name: "Signing in..." })).toBeTruthy();
  });

  it("shows official lobby when authenticated", () => {
    renderRoute(
      "/",
      createMockAuth({
        status: AuthStatus.AUTHENTICATED,
        user: { id: "nova", displayName: "Nova" },
        token: "tok",
      }),
    );

    expect(screen.getByText("Hello,")).toBeTruthy();
    expect(screen.getByText("Nova")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create/Join custom room" }),
    ).toBeTruthy();
  });

  it("shows a profile entry beside sign out", () => {
    renderRoute(
      "/",
      createMockAuth({
        status: AuthStatus.AUTHENTICATED,
        user: { id: "nova", displayName: "Nova" },
        token: "tok",
      }),
    );

    expect(screen.getByRole("link", { name: "Profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("opens the mode picker with compact three-column cards", async () => {
    renderRoute(
      "/",
      createMockAuth({
        status: AuthStatus.AUTHENTICATED,
        user: { id: "nova", displayName: "Nova" },
        token: "tok",
      }),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start" }));

    const dialog = await screen.findByRole("dialog", { name: "Choose mode" });
    expect(dialog).toHaveClass("sm:max-w-4xl");
    expect(
      screen.getByRole("button", { name: "Classic, Ready" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Demolition, Ready" }),
    ).toBeEnabled();
  });

  it("signs out from lobby", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const auth = createMockAuth({
      status: AuthStatus.AUTHENTICATED,
      user: { id: "helix", displayName: "Helix" },
      token: "tok",
    });
    auth.actions.signOut = signOut;

    renderRoute("/", auth);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
