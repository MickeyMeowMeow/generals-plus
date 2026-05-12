// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStatus } from "#/features/auth/auth-store";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";
import { createMockAuth } from "#/tests/helpers/auth";
import { renderRoute } from "#/tests/helpers/render";

const initialMatchState = useMatchConnectionStore.getInitialState();

describe("user route", () => {
  beforeEach(() => {
    useMatchConnectionStore.setState(initialMatchState, true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders user page with sign-in form", () => {
    renderRoute("/user", createMockAuth());

    expect(screen.getByRole("heading", { name: "Sign In" })).toBeTruthy();
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Sign in anonymously" }),
    ).toBeTruthy();
  });

  it("shows default display name in input", () => {
    renderRoute("/user", createMockAuth());

    expect(
      (screen.getByLabelText("Display name") as HTMLInputElement).value,
    ).toBe("Commander");
  });

  it("disables sign-in button while authenticating", () => {
    renderRoute("/user", createMockAuth({ status: AuthStatus.AUTHENTICATING }));

    expect(
      (
        screen.getByRole("button", {
          name: "Signing in...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("displays error message when auth fails", () => {
    renderRoute(
      "/user",
      createMockAuth({ status: "error", error: "Network error" }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Network error");
  });

  it("shows active player name when authenticated", () => {
    renderRoute(
      "/user",
      createMockAuth({
        status: AuthStatus.AUTHENTICATED,
        user: { id: "nova", displayName: "Nova" },
        token: "tok",
      }),
    );

    expect(screen.getByText("Nova")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter lobby" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("navigates to lobby when clicking Enter lobby button", async () => {
    renderRoute(
      "/user",
      createMockAuth({
        status: AuthStatus.AUTHENTICATED,
        user: { id: "scout", displayName: "Scout" },
        token: "tok",
      }),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Enter lobby" }));
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("updates display name input on typing", async () => {
    renderRoute("/user", createMockAuth());

    const user = userEvent.setup();
    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Ace");

    expect((input as HTMLInputElement).value).toBe("Ace");
  });

  it("clears match connection and signs out on sign-out click", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const resetMatchConnection = vi.fn().mockResolvedValue(undefined);

    const auth = createMockAuth({
      status: AuthStatus.AUTHENTICATED,
      user: { id: "helix", displayName: "Helix" },
      token: "tok",
    });
    auth.actions.signOut = signOut;
    useMatchConnectionStore.setState({ reset: resetMatchConnection });

    renderRoute("/user", auth);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(resetMatchConnection).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
