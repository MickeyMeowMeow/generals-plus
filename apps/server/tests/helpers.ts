import type { Room } from "@colyseus/core";
import { defineRoom, defineServer, LobbyRoom } from "@colyseus/core";
import "@colyseus/testing";
import { EventEmitter } from "node:events";

import type {
  Grid2D,
  IBaseGame,
  ICell,
  IClassicScoreboard,
  IGameResult,
  IGrid,
  IPlayerState,
  IVisionCell,
} from "@generals-plus/engine";
import {
  EffectRegistry,
  GameMode as GameModeEnum,
  GameStatus,
  Grid,
  PlayerStatus,
  SquareGrid,
  Terrain,
  Visibility,
} from "@generals-plus/engine";
import type { PlayerInit, RoomData } from "@generals-plus/shared-types";
import { PLAYER_COLOR_PALETTE, ROOM_NAMES } from "@generals-plus/shared-types";

import { MatchRoom } from "#/features/match/match-room";
import { MatchQueueRoom } from "#/features/queue/queue-room";
import { SetupRoom } from "#/features/setup/setup-room";

// ── Mock game helpers ────────────────────────────────────────

export function createMockCell(overrides?: Partial<ICell>): ICell {
  return {
    coordinate: overrides?.coordinate || { x: 0, y: 0 },
    terrain: overrides?.terrain || Terrain.PLAIN,
    isPassable: overrides?.isPassable ?? true,
    troopCount: overrides?.troopCount || 0,
    owner: overrides?.owner || null,
    vision: overrides?.vision || { radius: 1 },
    onTerrainChange: overrides?.onTerrainChange,
    addTroops: overrides?.addTroops || (() => {}),
  };
}

export function createMockGrid2D<T>(
  width = 16,
  height = 16,
  cells: T[][],
): Grid2D<T> {
  return new SquareGrid(width, height, cells);
}

export function createMockGrid(
  width = 16,
  height = 16,
  cells?: ICell[][],
): IGrid {
  if (!cells) {
    cells = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => createMockCell()),
    );
  }
  return new Grid(width, height, cells);
}

export function createMockGame(overrides?: Partial<IBaseGame>): IBaseGame {
  return {
    mode: GameModeEnum.CLASSIC,
    status: GameStatus.NOT_STARTED,
    effectRegistry: new EffectRegistry(),
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
    getVisionGrid: () =>
      new SquareGrid<IVisionCell>(1, 1, [
        [
          {
            coordinate: { x: 1, y: 1 },
            visibility: Visibility.VISIBLE,
            terrain: Terrain.PLAIN,
            troopCount: null,
            owner: null,
          },
        ],
      ]),
    getPlayerState: (): IPlayerState => ({
      playerId: "",
      teamId: "",
      status: PlayerStatus.ACTIVE,
    }),
    getScoreboard: (): IClassicScoreboard => ({
      mode: GameModeEnum.CLASSIC,
      players: [],
    }),
    ...overrides,
  };
}

export function createValidRoomData(overrides?: Partial<RoomData>): RoomData {
  return {
    mode: GameModeEnum.CLASSIC,
    game: createMockGame(),
    isPublic: true,
    playerInit: [
      {
        id: "p1",
        displayName: "Player1",
        teamId: "team_0",
        color: PLAYER_COLOR_PALETTE[0],
      } satisfies PlayerInit,
      {
        id: "p2",
        displayName: "Player2",
        teamId: "team_1",
        color: PLAYER_COLOR_PALETTE[1],
      } satisfies PlayerInit,
    ],
    ...overrides,
  };
}

// ── No-port test server setup ────────────────────────────────
// defineServer() registers rooms with matchMaker and sets it to READY state.
// No listen() call — no port binding.

defineServer({
  rooms: {
    lobby: defineRoom(LobbyRoom),
    queue: defineRoom(MatchQueueRoom).filterBy(["gameMode"]),
    setup: defineRoom(SetupRoom).filterBy(["gameMode"]).enableRealtimeListing(),
    match: defineRoom(MatchRoom).enableRealtimeListing(),
  },
});

// ── Room & client helpers ────────────────────────────────────

export async function createRoom<R extends Room>(
  roomName: string,
  options?: Record<string, unknown>,
) {
  const { matchMaker } = await import("@colyseus/core");
  const listing = await matchMaker.createRoom(roomName, options);
  return matchMaker.getLocalRoomById(listing.roomId) as R;
}

export async function connectClient(
  room: Room,
  authData: { id: string; email: string; displayName?: string },
) {
  const sessionId = crypto.randomUUID();

  await (room as unknown as RoomInternals)._reserveSeat(
    sessionId,
    {},
    authData,
  );

  const client = createMockClient(sessionId, authData, room);

  await (room as unknown as RoomInternals)._onJoin(
    client,
    { headers: new Headers(), ip: "127.0.0.1" },
    {},
  );

  return client;
}

function createMockClient(
  sessionId: string,
  authData: Record<string, unknown>,
  room: Room,
) {
  const ref = new EventEmitter();
  const roomEvents = (room as unknown as RoomInternals).onMessageEvents;

  const client = {
    id: sessionId,
    sessionId,
    state: 0,
    auth: authData,
    ref,
    reconnectionToken: "",
    view: undefined as unknown,
    userData: {} as Record<string, unknown>,
    readyState: 1,
    _enqueuedMessages: [] as unknown[],
    _afterNextPatchQueue: [] as unknown[],
    _joinedAt: Date.now(),
    _numMessagesLastSecond: 0,
    _lastMessageTime: 0,

    send(type: string, data?: unknown) {
      if (roomEvents?.events?.[type]) {
        roomEvents.emit(type, client, data);
      }
    },

    leave() {
      ref.emit("close");
    },

    raw() {},
    enqueueRaw() {},
    sendBytes() {},
    error() {},
    close() {
      client.leave();
    },
  };

  return client;
}

interface RoomInternals {
  _reserveSeat: (
    sessionId: string,
    joinOptions: unknown,
    authData: unknown,
  ) => Promise<boolean>;
  _onJoin: (
    client: unknown,
    authContext: unknown,
    connectionOptions: unknown,
  ) => Promise<void>;
  onMessageEvents: {
    events: Record<string, Array<(...args: unknown[]) => Promise<void>>>;
    emit: (type: string, ...args: unknown[]) => void;
  };
}

export { ROOM_NAMES };
