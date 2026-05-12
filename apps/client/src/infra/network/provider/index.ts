import type { UserProfile } from "#/common/types/user-profile";
import { ColyseusNetworkProvider } from "#/infra/network/provider/colyseus";
import type { NetworkProvider } from "#/infra/network/provider/interfaces";

export type { NetworkProvider };

export const networkProvider: NetworkProvider<UserProfile> =
  ColyseusNetworkProvider.fromEndpoint(
    import.meta.env.VITE_COLYSEUS_ENDPOINT || "ws://localhost:2567",
  );
