// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { appRoutes } from "../src/features/common/router";

function renderRoute(initialPath: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath],
  });

  return render(<RouterProvider router={router} />);
}

describe("app routes", () => {
  it("redirects root path to lobby", async () => {
    renderRoute("/");
    expect(await screen.findByRole("heading", { name: "Lobby" })).toBeTruthy();
  });

  it("renders match room page with route params", async () => {
    renderRoute("/match/alpha-room");
    expect(await screen.findByText("Room: alpha-room")).toBeTruthy();
  });

  it("renders not found page for unknown path", async () => {
    renderRoute("/unknown");
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
  });
});
