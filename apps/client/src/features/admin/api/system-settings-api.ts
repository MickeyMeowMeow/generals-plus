import { resolveColyseusEndpoint } from "#/infra/colyseus/connection";
import { networkProvider } from "#/infra/network/provider";

function getHttpEndpoint(): string {
  return resolveColyseusEndpoint().replace(/^ws/i, "http");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = networkProvider.getAuthToken();
  const response = await fetch(new URL(path, getHttpEndpoint()), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error ?? message;
    } catch {
      // Ignore non-JSON errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export interface SystemSettings {
  allowMapCreation: boolean;
  allowMapUpdates: boolean;
  systemBanner: string;
  maxMapsPerUser: number;
  maxTotalRooms: number;
  maxVsAiRooms: number;
  maintenanceMode: boolean;
}

export const systemSettingsApi = {
  async get(): Promise<SystemSettings> {
    return request<SystemSettings>("system/settings");
  },

  async update(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    return request<SystemSettings>("system/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },
};
