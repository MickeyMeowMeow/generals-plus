import { create } from "zustand";

import type { ColyseusAuthData } from "#/infra/colyseus/connection";
import { createSharedColyseusConnectionGateway } from "#/infra/colyseus/connection";

// State machine for the user authentication lifecycle:
// idle → hydrating → authenticated | idle
// idle → authenticating → authenticated | error
export type UserAuthStatus =
  | "idle"
  | "hydrating"
  | "authenticating"
  | "authenticated"
  | "error";

// Zustand store shape for user authentication state and actions.
export interface UserAuthStore {
  status: UserAuthStatus;
  hasHydrated: boolean;
  displayName: string | null;
  user: unknown;
  token: string | null;
  lastError: string | null;
  connect: (endpoint?: string) => void;
  hydrateUser: () => Promise<void>;
  signInAnonymously: (
    displayName: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  setError: (message: string) => void;
  reset: () => Promise<void>;
}

// Abstraction over the Colyseus auth endpoint, allowing tests to inject fakes.
export interface UserAuthGateway {
  onAuthChange<User = unknown>(
    callback: (response: ColyseusAuthData<User>) => void,
  ): () => void;
  getUserData<User = unknown>(): Promise<User>;
  signInAnonymously<User = unknown>(
    options?: Record<string, unknown>,
  ): Promise<ColyseusAuthData<User>>;
  signOut(): Promise<void>;
  getAuthToken(): string | null;
}

// Factory dependencies injected into the store for testability.
export interface UserAuthDependencies {
  createGateway: (endpoint?: string) => UserAuthGateway;
}

const createInitialState = (): Omit<
  UserAuthStore,
  | "connect"
  | "hydrateUser"
  | "signInAnonymously"
  | "signOut"
  | "setError"
  | "reset"
> => ({
  status: "idle",
  hasHydrated: false,
  displayName: null,
  user: null,
  token: null,
  lastError: null,
});

// Extract a display name from an opaque user object, trying common field names in priority order.
export function resolveDisplayNameFromUser(user: unknown): string | null {
  if (!user || typeof user !== "object") {
    return null;
  }

  const candidate =
    "displayName" in user && typeof user.displayName === "string"
      ? user.displayName
      : "name" in user && typeof user.name === "string"
        ? user.name
        : "username" in user && typeof user.username === "string"
          ? user.username
          : null;

  const nextDisplayName = candidate?.trim();
  return nextDisplayName ? nextDisplayName : null;
}

// Coerce an unknown thrown value into a readable string.
function normalizeError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

// Factory that creates a Zustand store bound to a Colyseus auth gateway.
// Accepts optional dependencies so tests can inject a fake gateway.
export function createUserAuthStore(
  dependencies: UserAuthDependencies = {
    createGateway: createSharedColyseusConnectionGateway,
  },
) {
  // Mutable references held outside Zustand state to avoid triggering re-renders.
  let gateway: UserAuthGateway | null = null;
  let unbindAuthChange: (() => void) | null = null;
  let hydrationPromise: Promise<void> | null = null;

  return create<UserAuthStore>()((set, get) => {
    // Subscribe to real-time auth state changes from the gateway.
    const bindAuthChange = (nextGateway: UserAuthGateway): void => {
      unbindAuthChange?.();
      unbindAuthChange = nextGateway.onAuthChange((response) => {
        const nextUser = response.user ?? null;

        set((state) => ({
          status: nextUser ? "authenticated" : "idle",
          hasHydrated: true,
          user: nextUser,
          token: response.token ?? null,
          displayName:
            resolveDisplayNameFromUser(nextUser) ??
            (nextUser ? state.displayName : null),
          lastError: null,
        }));
      });
    };

    // Lazily create or replace the gateway instance. A new endpoint always creates a fresh gateway.
    const resolveGateway = (endpoint?: string): UserAuthGateway => {
      if (endpoint) {
        gateway = dependencies.createGateway(endpoint);
        bindAuthChange(gateway);
        return gateway;
      }

      if (!gateway) {
        gateway = dependencies.createGateway();
        bindAuthChange(gateway);
      }

      return gateway;
    };

    return {
      ...createInitialState(),

      connect(endpoint) {
        resolveGateway(endpoint);
        set({
          lastError: null,
        });
      },

      // Restore session from the server. Deduplicates concurrent calls via a shared promise.
      async hydrateUser() {
        if (get().hasHydrated) {
          return;
        }

        // Await an in-flight hydration instead of starting a duplicate request.
        if (hydrationPromise) {
          await hydrationPromise;
          return;
        }

        set({
          status: "hydrating",
          lastError: null,
        });

        const activeGateway = resolveGateway();
        hydrationPromise = (async () => {
          try {
            const user = await activeGateway.getUserData();
            set((state) => ({
              status: "authenticated",
              hasHydrated: true,
              user,
              token: activeGateway.getAuthToken(),
              displayName:
                resolveDisplayNameFromUser(user) ?? state.displayName,
              lastError: null,
            }));
          } catch {
            set({
              status: "idle",
              hasHydrated: true,
              user: null,
              token: activeGateway.getAuthToken(),
              displayName: null,
              lastError: null,
            });
          }
        })().finally(() => {
          hydrationPromise = null;
        });

        await hydrationPromise;
      },

      // Authenticate as a guest using only a display name (no password).
      async signInAnonymously(displayName, metadata = {}) {
        const nextDisplayName = displayName.trim();
        if (!nextDisplayName) {
          get().setError("Display name is required");
          return;
        }

        set({
          status: "authenticating",
          lastError: null,
        });

        const activeGateway = resolveGateway();

        try {
          const response = await activeGateway.signInAnonymously({
            name: nextDisplayName,
            displayName: nextDisplayName,
            metadata,
          });

          const nextUser = response.user ?? null;
          set({
            status: "authenticated",
            hasHydrated: true,
            user: nextUser,
            token: response.token ?? activeGateway.getAuthToken(),
            displayName:
              resolveDisplayNameFromUser(nextUser) ?? nextDisplayName,
            lastError: null,
          });
        } catch (error) {
          set({
            status: "error",
            lastError: normalizeError(error, "Failed to authenticate user"),
          });
        }
      },

      // Clear the local session and notify the server.
      async signOut() {
        const activeGateway = resolveGateway();

        try {
          await activeGateway.signOut();
          set({
            status: "idle",
            hasHydrated: true,
            user: null,
            token: null,
            displayName: null,
            lastError: null,
          });
        } catch (error) {
          set({
            status: "error",
            lastError: normalizeError(error, "Failed to sign out"),
          });
        }
      },

      setError(message) {
        set({
          status: "error",
          lastError: message,
        });
      },

      // Tear down the gateway connection and reset all state to initial values.
      async reset() {
        if (gateway) {
          try {
            await gateway.signOut();
          } catch {
            // swallow sign-out errors during full reset
          }
        }

        unbindAuthChange?.();
        unbindAuthChange = null;
        gateway = null;
        hydrationPromise = null;
        set(createInitialState());
      },
    };
  });
}

export const useUserAuthStore = createUserAuthStore();
