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
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeTruthy();
  });

  it("signs in with email and password from root page", async () => {
    const signInWithEmailAndPassword = vi.fn().mockImplementation(async () => {
      setAuthValue(
        createMockAuth({
          status: AuthStatus.AUTHENTICATED,
          user: { id: "Nova", displayName: "Nova" },
          token: "token-1",
        }),
      );
    });

    const auth = createMockAuth();
    auth.actions.signInWithEmailAndPassword = signInWithEmailAndPassword;

    renderRoute("/", auth);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "nova@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      "nova@example.com",
      "hunter22",
    );
  });

  it("registers from root page", async () => {
    const registerWithEmailAndPassword = vi
      .fn()
      .mockImplementation(async () => {
        setAuthValue(
          createMockAuth({
            status: AuthStatus.AUTHENTICATED,
            user: { id: "Nova", displayName: "Nova" },
            token: "token-1",
          }),
        );
      });

    const auth = createMockAuth();
    auth.actions.registerWithEmailAndPassword = registerWithEmailAndPassword;

    renderRoute("/", auth);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Register" }));
    await user.clear(screen.getByLabelText("Username"));
    await user.type(screen.getByLabelText("Username"), "Nova");
    await user.type(screen.getByLabelText("Email"), "nova@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(registerWithEmailAndPassword).toHaveBeenCalledWith({
      displayName: "Nova",
      email: "nova@example.com",
      password: "hunter22",
    });
  });

  it("still supports guest sign-in from root page", async () => {
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
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Nova");
    await user.click(screen.getByRole("button", { name: "Enter as guest" }));

    expect(signInAnonymously).toHaveBeenCalledWith("Nova");
  });
});
