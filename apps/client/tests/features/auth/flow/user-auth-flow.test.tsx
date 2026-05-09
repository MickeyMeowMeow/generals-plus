// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStatus } from "#/features/auth/auth-store";
import { useMatchConnectionStore } from "#/features/match/store/match-connection-store";
import { createMockAuth } from "#/tests/helpers/auth";
import { renderRoute, setAuthValue } from "#/tests/helpers/render";

const initialMatchState = useMatchConnectionStore.getInitialState();

describe("user auth flow", () => {
  beforeEach(() => {
    useMatchConnectionStore.setState(initialMatchState, true);
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects unauthenticated players to user page", async () => {
    renderRoute("/lobby", createMockAuth());
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("signs in from user page and enters lobby", async () => {
    const signInAnonymously = vi.fn().mockImplementation(async () => {
      setAuthValue(
        createMockAuth({
          status: AuthStatus.AUTHENTICATED,
          user: { id: "Nova", displayName: "Nova" },
          token: "token-1",
        }),
      );
    });

    const auth = createMockAuth();
    auth.actions.signInAnonymously = signInAnonymously;

    renderRoute("/user", auth);

    const user = userEvent.setup();
    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Nova");
    await user.click(
      screen.getByRole("button", { name: "Sign in anonymously" }),
    );

    expect(signInAnonymously).toHaveBeenCalledWith("Nova");
  });

  it("signs out from user page and clears active room state", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const resetMatchConnection = vi.fn().mockResolvedValue(undefined);

    const auth = createMockAuth({
      status: AuthStatus.AUTHENTICATED,
      user: { id: "helix", displayName: "Helix" },
      token: "token-2",
    });
    auth.actions.signOut = signOut;

    useMatchConnectionStore.setState({
      reset: resetMatchConnection,
    });

    renderRoute("/user", auth);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(resetMatchConnection).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
