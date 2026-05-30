// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { UserProfile } from "#/common/types/user-profile";
import { useAuth } from "#/features/auth/hooks";
import type { AuthProvider as AuthProviderComponent } from "#/features/auth/providers/auth-provider";
import type { NetworkProvider } from "#/infra/network/provider";

const { AuthProvider } = await vi.importActual<{
  AuthProvider: typeof AuthProviderComponent;
}>("#/features/auth/providers/auth-provider");

function Probe() {
  const { state, actions } = useAuth();
  return (
    <button
      type="button"
      onClick={() =>
        actions.updateUserProfile({
          displayName: "Nova Prime",
        })
      }
    >
      {state.user?.displayName ?? "missing"}
    </button>
  );
}

describe("AuthProvider profile updates", () => {
  it("updates local auth user after a profile save", async () => {
    const provider = {
      getUserData: vi.fn().mockResolvedValue({
        id: "u1",
        displayName: "Nova",
      }),
      getAuthToken: vi.fn(() => "tok"),
      onAuthChange: vi.fn(() => () => {}),
      updateUserProfile: vi.fn().mockResolvedValue({
        id: "u1",
        displayName: "Nova Prime",
      }),
    } as unknown as NetworkProvider<UserProfile>;

    render(
      <AuthProvider provider={provider}>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByRole("button", { name: "Nova" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Nova" }));

    expect(
      await screen.findByRole("button", { name: "Nova Prime" }),
    ).toBeTruthy();
  });
});
