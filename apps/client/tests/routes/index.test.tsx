// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStatus } from "#/features/auth/auth-store";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";
import { createMockAuth } from "#/tests/helpers/auth";
import { renderRoute } from "#/tests/helpers/render";

const initialMatchState = useMatchConnectionStore.getInitialState();

describe("index route", () => {
  beforeEach(() => {
    useMatchConnectionStore.setState(initialMatchState, true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders sign-in form on root", () => {
    renderRoute("/", createMockAuth());

    expect(screen.getByRole("heading", { name: "Sign In" })).toBeTruthy();
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Sign in anonymously" }),
    ).toBeTruthy();
  });

  it("shows default display name in input", () => {
    renderRoute("/", createMockAuth());

    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");
  });

  it("disables sign-in button while authenticating", () => {
    renderRoute("/", createMockAuth({ status: AuthStatus.AUTHENTICATING }));

    expect(screen.getByText("Checking session")).toBeTruthy();
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

    expect(
      screen.getByRole("heading", { name: "Choose operation" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Play Classic/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create custom room" }),
    ).toBeTruthy();
  });

  it("signs out from lobby and clears active room state", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const resetMatchConnection = vi.fn().mockResolvedValue(undefined);
    const auth = createMockAuth({
      status: AuthStatus.AUTHENTICATED,
      user: { id: "helix", displayName: "Helix" },
      token: "tok",
    });
    auth.actions.signOut = signOut;
    useMatchConnectionStore.setState({ reset: resetMatchConnection });

    renderRoute("/", auth);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(resetMatchConnection).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
