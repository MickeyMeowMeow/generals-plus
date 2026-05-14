import type { UserProfile } from "#/common/types/user-profile";
import { resolveColyseusEndpoint } from "#/infra/colyseus/connection";
import { ColyseusNetworkProvider } from "#/infra/network/provider/colyseus";
import type { NetworkProvider } from "#/infra/network/provider/interfaces";

export type { NetworkProvider };

let networkProviderInstance: NetworkProvider<UserProfile> | null = null;

function getNetworkProvider(): NetworkProvider<UserProfile> {
  networkProviderInstance ??= ColyseusNetworkProvider.fromEndpoint(
    resolveColyseusEndpoint(),
  );
  return networkProviderInstance;
}

export const networkProvider: NetworkProvider<UserProfile> = {
  signInAnonymously: (...args) =>
    getNetworkProvider().signInAnonymously(...args),
  signOut: () => getNetworkProvider().signOut(),
  getUserData: () => getNetworkProvider().getUserData(),
  getAuthToken: () => getNetworkProvider().getAuthToken(),
  onAuthChange: (...args) => getNetworkProvider().onAuthChange(...args),
  joinOrCreate: (...args) => getNetworkProvider().joinOrCreate(...args),
  join: (...args) => getNetworkProvider().join(...args),
  joinById: (...args) => getNetworkProvider().joinById(...args),
  consumeSeatReservation: (...args) =>
    getNetworkProvider().consumeSeatReservation(...args),
  create: (...args) => getNetworkProvider().create(...args),
  restoreSession: (...args) => getNetworkProvider().restoreSession(...args),
};
