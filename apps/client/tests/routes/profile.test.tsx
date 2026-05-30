// @vitest-environment jsdom

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthStatus } from "#/features/auth/auth-store";
import { createMockAuth } from "#/tests/helpers/auth";
import { renderRoute } from "#/tests/helpers/render";

describe("profile route", () => {
  afterEach(() => cleanup());

  it("renders ratings and saves display name", async () => {
    const updateUserProfile = vi.fn().mockResolvedValue(undefined);
    const auth = createMockAuth({
      status: AuthStatus.AUTHENTICATED,
      user: {
        id: "u1",
        displayName: "Nova",
        ratings: {
          classic: 1200,
          demolition: 980,
          turf_war: 1000,
          biohazard: 1000,
          payload: 1000,
          rugby: 1000,
          collapse: 1000,
          domination: 1100,
          espionage: 1000,
        },
        preferences: {
          backgroundImage: { source: "preset", presetId: "classic" },
        },
      },
      token: "tok",
    });
    auth.actions.updateUserProfile = updateUserProfile;

    renderRoute("/profile", auth);

    expect(screen.getByRole("heading", { name: "Profile" })).toBeTruthy();
    const ratings = screen.getByRole("heading", {
      name: "Ratings",
    }).parentElement;
    expect(ratings).toBeTruthy();
    expect(within(ratings as HTMLElement).getByText("Classic")).toBeTruthy();
    expect(within(ratings as HTMLElement).getByText("1200")).toBeTruthy();

    await userEvent.clear(screen.getByLabelText("Display name"));
    await userEvent.type(screen.getByLabelText("Display name"), "Nova Prime");
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(updateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Nova Prime" }),
    );
  });
});
