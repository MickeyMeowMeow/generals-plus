import { create } from "zustand";

import type { ColyseusAuthData } from "#/infra/colyseus/connection";
import { createSharedColyseusConnectionGateway } from "#/infra/colyseus/connection";

export type UserAuthStatus =
  | "idle"
  | "hydrating"
  | "authenticating"
  | "authenticated"
  | "error";

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

function normalizeError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

export function createUserAuthStore(
  dependencies: UserAuthDependencies = {
    createGateway: createSharedColyseusConnectionGateway,
  },
) {
  let gateway: UserAuthGateway | null = null;
  let unbindAuthChange: (() => void) | null = null;
  let hydrationPromise: Promise<void> | null = null;

  return create<UserAuthStore>()((set, get) => {
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

      async hydrateUser() {
        if (get().hasHydrated) {
          return;
        }

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
