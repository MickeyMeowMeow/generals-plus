import { useEffect, useState } from "react";

import { resolveColyseusEndpoint } from "#/infra/colyseus/connection";
import { networkProvider } from "#/infra/network/provider";

function getHttpEndpoint(): string {
  const endpoint = resolveColyseusEndpoint().replace(/^ws/i, "http");
  return endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
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

export function useSystemSettings(): SystemSettings | null {
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    const endpoint = getHttpEndpoint();
    const eventSource = new EventSource(
      new URL("system/settings/stream", endpoint).toString(),
    );

    eventSource.onmessage = (event) => {
      try {
        setSettings(JSON.parse(event.data));
      } catch {
        // Ignore malformed data
      }
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects; close to avoid retry storms on fatal errors
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return settings;
}
