// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { AppHeader } from "#/components/layout/app-header";
import { APP_TITLE } from "#/config/ui-constants";

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe("AppHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders app title", () => {
    renderWithRouter("/");
    expect(screen.getByText(APP_TITLE)).toBeTruthy();
  });

  it("renders navigation links", () => {
    renderWithRouter("/");
    expect(screen.getByText("User")).toBeTruthy();
    expect(screen.getByText("Lobby")).toBeTruthy();
  });

  it("marks current route as active", () => {
    renderWithRouter("/user");
    const userLink = screen.getByText("User").closest("a");
    expect(userLink?.className).toContain("border-game-accent");
  });

  it("does not mark inactive routes as active", () => {
    renderWithRouter("/user");
    const lobbyLink = screen.getByText("Lobby").closest("a");
    expect(lobbyLink?.className).not.toContain("border-game-accent");
  });
});
