import { vi } from "vitest";

import type { AuthContextValue, AuthState } from "#/features/auth/auth-store";
import { AuthStatus } from "#/features/auth/auth-store";

export function createMockAuth(
  overrides: Partial<AuthState> = {},
): AuthContextValue {
  return {
    state: {
      status: AuthStatus.IDLE,
      isHydrated: true,
      user: null,
      token: null,
      error: null,
      ...overrides,
    },
    actions: {
      hydrate: vi.fn().mockResolvedValue(undefined),
      signInAnonymously: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
      clearError: vi.fn(),
    },
  };
}
