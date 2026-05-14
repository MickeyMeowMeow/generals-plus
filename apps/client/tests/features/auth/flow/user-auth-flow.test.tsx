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

  it("shows root auth surface for unauthenticated players", async () => {
    renderRoute("/", createMockAuth());
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("signs in from root page", async () => {
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

    renderRoute("/", auth);

    const user = userEvent.setup();
    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Nova");
    await user.click(
      screen.getByRole("button", { name: "Sign in anonymously" }),
    );

    expect(signInAnonymously).toHaveBeenCalledWith("Nova");
  });
});
