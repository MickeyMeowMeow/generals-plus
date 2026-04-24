import { describe, expect, it, vi } from "vitest";

import type {
  UserAuthDependencies,
  UserAuthGateway,
} from "#/features/auth/store/userAuthStore";
import {
  createUserAuthStore,
  resolveDisplayNameFromUser,
} from "#/features/auth/store/userAuthStore";
import type { ColyseusAuthData } from "#/infra/colyseus/connection";

interface AuthGatewayHarness {
  gateway: UserAuthGateway;
  emitAuthChange: (response: ColyseusAuthData) => void;
}

function createGatewayHarness(): AuthGatewayHarness {
  let authChangeHandler: ((response: ColyseusAuthData) => void) | null = null;

  const gateway: UserAuthGateway = {
    onAuthChange: vi.fn().mockImplementation((callback) => {
      authChangeHandler = callback;
      return () => {
        authChangeHandler = null;
      };
    }),
    getUserData: vi.fn().mockResolvedValue({}),
    signInAnonymously: vi.fn().mockResolvedValue({
      user: { name: "Commander" },
      token: "token-1",
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getAuthToken: vi.fn().mockReturnValue(null),
  };

  return {
    gateway,
    emitAuthChange(response) {
      authChangeHandler?.(response);
    },
  };
}

function createDependencies(gateway: UserAuthGateway): UserAuthDependencies & {
  createGateway: ReturnType<typeof vi.fn>;
} {
  return {
    createGateway: vi.fn().mockReturnValue(gateway),
  };
}

describe("user auth store", () => {
  it("starts in idle state", () => {
    const { gateway } = createGatewayHarness();
    const store = createUserAuthStore(createDependencies(gateway));

    expect(store.getState().status).toBe("idle");
    expect(store.getState().hasHydrated).toBe(false);
    expect(store.getState().displayName).toBeNull();
    expect(store.getState().token).toBeNull();
  });

  it("hydrates authenticated user from existing token", async () => {
    const { gateway } = createGatewayHarness();
    gateway.getUserData = vi.fn().mockResolvedValue({ username: "alpha" });
    gateway.getAuthToken = vi.fn().mockReturnValue("token-123");

    const store = createUserAuthStore(createDependencies(gateway));
    await store.getState().hydrateUser();

    expect(gateway.getUserData).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe("authenticated");
    expect(store.getState().displayName).toBe("alpha");
    expect(store.getState().token).toBe("token-123");
    expect(store.getState().hasHydrated).toBe(true);
  });

  it("falls back to idle when no existing session is available", async () => {
    const { gateway } = createGatewayHarness();
    gateway.getUserData = vi
      .fn()
      .mockRejectedValue(new Error("missing auth.token"));

    const store = createUserAuthStore(createDependencies(gateway));
    await store.getState().hydrateUser();

    expect(store.getState().status).toBe("idle");
    expect(store.getState().hasHydrated).toBe(true);
    expect(store.getState().user).toBeNull();
    expect(store.getState().lastError).toBeNull();
  });

  it("authenticates anonymous user with display name", async () => {
    const { gateway } = createGatewayHarness();
    gateway.signInAnonymously = vi.fn().mockResolvedValue({
      user: { displayName: "Scout" },
      token: "token-7",
    });

    const store = createUserAuthStore(createDependencies(gateway));
    await store.getState().signInAnonymously("Scout");

    expect(gateway.signInAnonymously).toHaveBeenCalledWith({
      name: "Scout",
      displayName: "Scout",
      metadata: {},
    });
    expect(store.getState().status).toBe("authenticated");
    expect(store.getState().displayName).toBe("Scout");
    expect(store.getState().token).toBe("token-7");
    expect(store.getState().lastError).toBeNull();
  });

  it("rejects empty display name", async () => {
    const { gateway } = createGatewayHarness();

    const store = createUserAuthStore(createDependencies(gateway));
    await store.getState().signInAnonymously("   ");

    expect(gateway.signInAnonymously).not.toHaveBeenCalled();
    expect(store.getState().status).toBe("error");
    expect(store.getState().lastError).toBe("Display name is required");
  });

  it("signs out and clears user session", async () => {
    const { gateway } = createGatewayHarness();
    const store = createUserAuthStore(createDependencies(gateway));

    await store.getState().signInAnonymously("Delta");
    await store.getState().signOut();

    expect(gateway.signOut).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe("idle");
    expect(store.getState().displayName).toBeNull();
    expect(store.getState().token).toBeNull();
    expect(store.getState().user).toBeNull();
  });

  it("applies auth change events from gateway", () => {
    const { gateway, emitAuthChange } = createGatewayHarness();
    const store = createUserAuthStore(createDependencies(gateway));

    store.getState().connect();

    emitAuthChange({
      user: { name: "Omega" },
      token: "token-live",
    });

    expect(store.getState().status).toBe("authenticated");
    expect(store.getState().displayName).toBe("Omega");
    expect(store.getState().token).toBe("token-live");

    emitAuthChange({
      user: null,
      token: null,
    });

    expect(store.getState().status).toBe("idle");
    expect(store.getState().displayName).toBeNull();
  });
});

describe("resolveDisplayNameFromUser", () => {
  it("prefers displayName over other fields", () => {
    expect(
      resolveDisplayNameFromUser({
        displayName: "Ranger",
        name: "Fallback",
      }),
    ).toBe("Ranger");
  });

  it("returns null when no recognized field exists", () => {
    expect(resolveDisplayNameFromUser({ id: "u-1" })).toBeNull();
    expect(resolveDisplayNameFromUser(null)).toBeNull();
  });
});
