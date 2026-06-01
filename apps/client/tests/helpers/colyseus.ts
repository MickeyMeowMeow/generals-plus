import { vi } from "vitest";

import type { RoomClient } from "#/infra/network/room";

export function createRoom<State = unknown>(): RoomClient {
  return {
    roomId: "room-1",
    sessionId: "session-1",
    state: {} as State,
    send: vi.fn(),
    leave: vi.fn().mockResolvedValue(1000),
    onStateChange: vi.fn().mockReturnValue({ clear: vi.fn() }),
    onMessage: vi.fn().mockReturnValue(() => {}),
    onStatusChange: vi.fn(),
    onError: vi.fn().mockReturnValue({ clear: vi.fn() }),
    onLeave: vi.fn().mockReturnValue({ clear: vi.fn() }),
  };
}
