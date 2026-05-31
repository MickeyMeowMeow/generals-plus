import type { UserProfile } from "#/common/types/user-profile";
import { resolveColyseusEndpoint } from "#/infra/colyseus/connection";
import { ColyseusNetworkProvider } from "#/infra/network/provider/colyseus";
import type { NetworkProvider } from "#/infra/network/provider/interfaces";

export type { NetworkProvider };

let networkProviderInstance: NetworkProvider<UserProfile> | null = null;

/**
 * Lazily create the concrete network provider from the configured Colyseus URL.
 *
 * Tests can import the exported facade without immediately resolving endpoints
 * or opening provider state. The first real network call constructs the provider
 * once, and every route/hook then talks through the same auth and room gateway.
 */
function getNetworkProvider(): NetworkProvider<UserProfile> {
  networkProviderInstance ??= ColyseusNetworkProvider.fromEndpoint(
    resolveColyseusEndpoint(),
  );
  return networkProviderInstance;
}

/**
 * Stable network facade used by auth, queue, setup, and match hooks.
 *
 * The facade keeps callers decoupled from the Colyseus implementation and makes
 * room operations (`joinOrCreate`, `joinById`, `create`, and seat consumption)
 * share one endpoint/auth source.
 */
export const networkProvider: NetworkProvider<UserProfile> = {
  signInWithEmailAndPassword: (...args) =>
    getNetworkProvider().signInWithEmailAndPassword(...args),
  registerWithEmailAndPassword: (...args) =>
    getNetworkProvider().registerWithEmailAndPassword(...args),
  signInAnonymously: (...args) =>
    getNetworkProvider().signInAnonymously(...args),
  signOut: () => getNetworkProvider().signOut(),
  getUserData: () => getNetworkProvider().getUserData(),
  updateUserProfile: (...args) =>
    getNetworkProvider().updateUserProfile(...args),
  getAuthToken: () => getNetworkProvider().getAuthToken(),
  onAuthChange: (...args) => getNetworkProvider().onAuthChange(...args),
  joinOrCreate: (...args) => getNetworkProvider().joinOrCreate(...args),
  join: (...args) => getNetworkProvider().join(...args),
  joinById: (...args) => getNetworkProvider().joinById(...args),
  consumeSeatReservation: (...args) =>
    getNetworkProvider().consumeSeatReservation(...args),
  create: (...args) => getNetworkProvider().create(...args),
  createCustomRoom: (...args) => getNetworkProvider().createCustomRoom(...args),
  resolveCustomRoom: (...args) =>
    getNetworkProvider().resolveCustomRoom(...args),
  checkAiHealth: () => getNetworkProvider().checkAiHealth(),
};
