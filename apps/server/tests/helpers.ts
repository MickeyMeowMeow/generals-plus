import { JWT } from "@colyseus/auth";
import { defineRoom, defineServer, LobbyRoom } from "@colyseus/core";
import { ColyseusTestServer } from "@colyseus/testing";
import type {
  IBaseGame,
  IGameResult,
  IGrid,
  IPlayerStats,
} from "@generals-plus/engine";
import { GameMode as GameModeEnum, GameStatus } from "@generals-plus/engine";
import type { PlayerInit, RoomData } from "@generals-plus/shared-types";
import { ROOM_NAMES } from "@generals-plus/shared-types";

import { MatchRoom } from "#/features/match/match-room";
import { MatchQueueRoom } from "#/features/queue/queue-room";
import { SetupRoom } from "#/features/setup/setup-room";

function createMockGrid(width = 16, height = 16): IGrid {
  return {
    targetId: "mock-grid",
    width,
    height,
    get: () => null,
    getNeighbors: () => [],
    isValid: () => true,
    forEach: () => {},
    effects: [],
    attachEffect: () => {},
    removeEffect: () => {},
  };
}

export function createMockGame(overrides?: Partial<IBaseGame>): IBaseGame {
  return {
    mode: GameModeEnum.CLASSIC,
    status: GameStatus.NOT_STARTED,
    tick: 0,
    grid: createMockGrid(),
    players: new Map(),
    teams: new Map(),
    items: [],
    startGame: () => {},
    nextTick: () => {},
    handleAction: () => false,
    checkGameEnd: (): IGameResult | null => null,
    forceEnd: (): IGameResult => ({
      mode: GameModeEnum.CLASSIC,
      winnerTeamId: null,
    }),
    getVisionGrid: () => ({
      width: 16,
      height: 16,
      get: () => null,
      getNeighbors: () => [],
      isValid: () => true,
      forEach: () => {},
    }),
    getPlayerStats: (): IPlayerStats => ({ playerId: "", troops: 0, land: 0 }),
    ...overrides,
  };
}

export function createValidRoomData(overrides?: Partial<RoomData>): RoomData {
  return {
    mode: GameModeEnum.CLASSIC,
    game: createMockGame(),
    isPublic: true,
    playerInit: [
      { id: "p1", username: "Player1", teamId: "team_0" } satisfies PlayerInit,
      { id: "p2", username: "Player2", teamId: "team_1" } satisfies PlayerInit,
    ],
    ...overrides,
  };
}

const workerBasePort =
  18567 + (Number(process.env.VITEST_WORKER_ID ?? "1") - 1) * 100;
let _nextPort = workerBasePort;

export async function createTestServer() {
  const testConfig = defineServer({
    rooms: {
      lobby: defineRoom(LobbyRoom),
      queue: defineRoom(MatchQueueRoom).filterBy(["gameMode"]),
      setup: defineRoom(SetupRoom)
        .filterBy(["gameMode"])
        .enableRealtimeListing(),
      match: defineRoom(MatchRoom).enableRealtimeListing(),
    },
  });

  const port = _nextPort++;
  await testConfig.listen(port);
  return new ColyseusTestServer(testConfig);
}

export function createTestToken(userData: {
  id: string;
  email: string;
}): Promise<string> {
  return JWT.sign(userData);
}

export { ROOM_NAMES };
