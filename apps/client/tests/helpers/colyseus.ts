import { vi } from "vitest";

import type {
  ColyseusAuth,
  ColyseusClient,
  ColyseusRoom,
} from "#/infra/colyseus/connection";

export function createAuthStub(): ColyseusAuth {
  return {
    token: null,
    onChange: vi.fn().mockReturnValue(() => {}),
    getUserData: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    registerWithEmailAndPassword: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
  };
}

export function createRoom<State = unknown, Message = unknown>(
  name = "skirmish-room",
): ColyseusRoom<State, Message> {
  return {
    roomId: "room-1",
    name,
    sessionId: "session-1",
    state: {} as State,
    leave: vi.fn().mockResolvedValue(1000),
    send: vi.fn(),
    sendBytes: vi.fn(),
    sendUnreliable: vi.fn(),
    ping: vi.fn(),
    removeAllListeners: vi.fn(),
    onStateChange: vi.fn().mockReturnValue({ clear: vi.fn() }),
    onMessage: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue({ clear: vi.fn() }),
    onLeave: vi.fn().mockReturnValue({ clear: vi.fn() }),
  };
}

export function createMockClient(
  overrides: Partial<ColyseusClient> = {},
): ColyseusClient {
  return {
    auth: createAuthStub(),
    joinOrCreate: vi.fn(),
    joinById: vi.fn(),
    create: vi.fn(),
    join: vi.fn(),
    consumeSeatReservation: vi.fn(),
    getLatency: vi.fn(),
    http: {},
    ...overrides,
  };
}
