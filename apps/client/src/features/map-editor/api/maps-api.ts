import type {
  CreateCustomMapRequest,
  CustomMap,
  CustomMapListResponse,
  UpdateCustomMapRequest,
} from "@generals-plus/shared-types";

import { resolveColyseusEndpoint } from "#/infra/network/connection";
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
    let details: unknown;
    try {
      const payload = (await response.json()) as {
        error?: string;
        details?: unknown;
      };
      message = payload.error ?? message;
      details = payload.details;
    } catch {
      // Ignore non-JSON error bodies
    }
    const err = new Error(message) as Error & {
      status: number;
      details?: unknown;
    };
    err.status = response.status;
    err.details = details;
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export interface ListMapsParams {
  page?: number;
  limit?: number;
  mode?: string;
  sort?: "plays" | "likes" | "date";
  search?: string;
}

export const mapsApi = {
  async list(params: ListMapsParams = {}): Promise<CustomMapListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.mode) query.set("mode", params.mode);
    if (params.sort) query.set("sort", params.sort);
    if (params.search) query.set("search", params.search);
    const qs = query.toString();
    return request<CustomMapListResponse>(`maps${qs ? `?${qs}` : ""}`);
  },

  async get(id: string): Promise<CustomMap> {
    return request<CustomMap>(`maps/${encodeURIComponent(id)}`);
  },

  async create(payload: CreateCustomMapRequest): Promise<CustomMap> {
    return request<CustomMap>("maps", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async update(
    id: string,
    payload: UpdateCustomMapRequest,
  ): Promise<CustomMap> {
    return request<CustomMap>(`maps/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async remove(id: string): Promise<void> {
    await request<void>(`maps/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async toggleLike(id: string): Promise<{ result: "liked" | "unliked" }> {
    return request<{ result: "liked" | "unliked" }>(
      `maps/${encodeURIComponent(id)}/like`,
      { method: "POST" },
    );
  },
};
