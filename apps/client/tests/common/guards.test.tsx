// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createMockAuth } from "#tests/helpers/auth";
import { renderRoute } from "#tests/helpers/render";

describe("app routes", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders root auth surface for unauthenticated players", async () => {
    renderRoute("/", createMockAuth());
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeTruthy();
  });

  it("renders official lobby for authenticated players", async () => {
    renderRoute(
      "/",
      createMockAuth({
        status: "authenticated",
        user: { id: "scout", displayName: "Scout" },
        token: "token-1",
      }),
    );
    expect(await screen.findByText("Hello,")).toBeTruthy();
    expect(screen.getByText("Scout")).toBeTruthy();
  });

  it("does not register old business routes", async () => {
    renderRoute(
      "/lobby",
      createMockAuth({
        status: "authenticated",
        user: { id: "scout", displayName: "Scout" },
        token: "token-1",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
  });

  it("keeps unauthenticated players on match URL with auth surface", async () => {
    renderRoute("/match/alpha-room", createMockAuth());
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeTruthy();
  });

  it("renders not found page for unknown path", async () => {
    renderRoute("/unknown", createMockAuth());
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
  });
});
