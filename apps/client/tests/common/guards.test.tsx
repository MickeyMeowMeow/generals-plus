// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createMockAuth } from "#/tests/helpers/auth";
import { renderRoute } from "#/tests/helpers/render";

describe("app routes", () => {
  afterEach(() => {
    cleanup();
  });

  it("redirects root path to user page", async () => {
    renderRoute("/", createMockAuth());
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("renders lobby for authenticated players", async () => {
    renderRoute(
      "/lobby",
      createMockAuth({
        status: "authenticated",
        user: { id: "scout", displayName: "Scout" },
        token: "token-1",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("redirects unauthenticated players away from protected routes", async () => {
    renderRoute("/match/alpha-room", createMockAuth());
    expect(
      await screen.findByRole("heading", { name: "Sign In" }),
    ).toBeTruthy();
  });

  it("renders not found page for unknown path", async () => {
    renderRoute("/unknown", createMockAuth());
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
  });
});
