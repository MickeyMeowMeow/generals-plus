// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserAuthStore } from "@/features/auth/store/userAuthStore";
import { appRoutes } from "@/features/common/router";

function renderRoute(initialPath: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath],
  });

  return render(<RouterProvider router={router} />);
}

describe("app routes", () => {
  const initialAuthState = useUserAuthStore.getInitialState();

  beforeEach(() => {
    useUserAuthStore.setState(initialAuthState, true);
    useUserAuthStore.setState({
      hydrateUser: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects root path to user page", async () => {
    renderRoute("/");
    expect(await screen.findByRole("heading", { name: "User" })).toBeTruthy();
  });

  it("renders lobby for authenticated players", async () => {
    useUserAuthStore.setState({
      status: "authenticated",
      hasHydrated: true,
      displayName: "Scout",
      user: { name: "Scout" },
      token: "token-1",
      lastError: null,
    });

    renderRoute("/lobby");
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("redirects unauthenticated players away from protected routes", async () => {
    useUserAuthStore.setState({
      status: "idle",
      hasHydrated: true,
      displayName: null,
      user: null,
      token: null,
      lastError: null,
    });

    renderRoute("/match/alpha-room");
    expect(await screen.findByRole("heading", { name: "User" })).toBeTruthy();
  });

  it("renders not found page for unknown path", async () => {
    renderRoute("/unknown");
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
  });
});
