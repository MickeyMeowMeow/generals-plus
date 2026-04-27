import { JWT } from "@colyseus/auth";
import { defineRoom, defineServer, LobbyRoom } from "@colyseus/core";
import { boot } from "@colyseus/testing";
import { Terrain } from "@generals-plus/engine";
import type {
  MapConfig,
  PlayerInit,
  RoomData,
} from "@generals-plus/shared-types";

import { MatchRoom } from "#features/match/match-room";
import { MatchQueueRoom } from "#features/queue/queue-room";
import { SetupRoom } from "#features/setup/setup-room";

function buildDefaultMapConfig(): MapConfig {
  const width = 16;
  const height = 16;
  const cells = Array.from({ length: width * height }, (_, i) => {
    const x = i % width;
    const y = Math.floor(i / width);
    const isEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    return {
      terrain: isEdge ? Terrain.MOUNTAIN : Terrain.PLAIN,
      isPassable: !isEdge,
    };
  });
  return { width, height, cells };
}

interface TestRoomData extends RoomData {}

export function createValidRoomData(
  overrides?: Partial<TestRoomData>,
): TestRoomData {
  return {
    mode: "classic",
    map: buildDefaultMapConfig(),
    isPublic: true,
    playerInit: [
      { id: "p1", username: "Player1", teamId: "team_0" } satisfies PlayerInit,
      { id: "p2", username: "Player2", teamId: "team_1" } satisfies PlayerInit,
    ],
    ...overrides,
  } as TestRoomData;
}

const testConfig = defineServer({
  rooms: {
    lobby: defineRoom(LobbyRoom),
    queue: defineRoom(MatchQueueRoom).filterBy(["gameMode"]),
    setup: defineRoom(SetupRoom).filterBy(["gameMode"]).enableRealtimeListing(),
    match: defineRoom(MatchRoom).enableRealtimeListing(),
  },
});

let _nextPort = 18567;

export async function createTestServer() {
  const port = _nextPort++;
  return boot(testConfig, port);
}

export function createTestToken(userData: {
  id: string;
  email: string;
}): Promise<string> {
  return JWT.sign(userData);
}
