import { JWT } from "@colyseus/auth";
import { GameMode } from "@generals-plus/engine";
import type { QueuePlayer } from "@generals-plus/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MatchQueueRoom } from "#/features/queue/queue-room";
import {
  connectClient,
  createMockGame,
  createRoom,
  ROOM_NAMES,
} from "#tests/helpers";

function captureErrors(client: {
  send: (type: string, data?: unknown) => void;
}) {
  const sent: string[] = [];
  const originalSend = client.send.bind(client);
  client.send = (type: string, data?: unknown) => {
    if (type === "error") sent.push(data as string);
    originalSend(type, data);
  };
  return sent;
}

const mocks = vi.hoisted(() => ({
  getRating: vi.fn().mockResolvedValue(1000),
  createGame: vi.fn(),
  generateSeed: vi.fn(() => 12345),
}));

vi.mock("#/infra/db/repositories/MongoUserRepository", () => ({
  MongoUserRepository: class {
    getRating = mocks.getRating;
  },
}));

vi.mock("#/features/game/utils", () => ({
  createGame: mocks.createGame,
  generateSeed: mocks.generateSeed,
}));

interface QueueMatchGroup {
  averageRank: number;
  clients: Array<{
    auth: { id: string };
    userData: { rank: number; currentCycle: number };
  }>;
  ready?: boolean;
}

function getGroups(room: MatchQueueRoom): QueueMatchGroup[] {
  return (room as unknown as { groups: QueueMatchGroup[] }).groups;
}

describe("MatchQueueRoom", () => {
  let room: MatchQueueRoom;

  beforeEach(() => {
    mocks.getRating.mockResolvedValue(1000);
    mocks.createGame.mockReturnValue(createMockGame());
  });

  afterEach(() => {
    if (room) {
      room.disconnect();
    }
  });

  it("creates queue room with classic gameMode", async () => {
    room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
    });

    expect(room).toBeDefined();
    expect(room.roomId).toBeDefined();
  });

  it("creates separate rooms for different gameModes", async () => {
    const room1 = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
    });
    const room2 = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.TURF_WAR,
    });

    expect(room1.roomId).not.toBe(room2.roomId);

    room1.disconnect();
    room2.disconnect();
  });

  it("does not advance countdown until minPlayers have joined", async () => {
    room = await createRoom<MatchQueueRoom>("queue", {
      gameMode: "classic",
      countdownCycles: 2,
    });

    await connectClient(room, {
      id: "p1",
      email: "p1@test.com",
    });

    expect(room.clients.length).toBe(1);

    for (let i = 0; i < 10; i++) {
      room.reassignMatchGroups();
    }

    expect(room.clients[0].userData.currentCycle).toBe(0);

    await connectClient(room, {
      id: "p2",
      email: "p2@test.com",
    });

    expect(room.clients.length).toBe(2);

    room.reassignMatchGroups();

    expect(room.clients.some((c) => c.userData.currentCycle > 0)).toBe(true);
  });

  it("uses DEFAULT_MAX_PLAYERS as the default match group size", async () => {
    room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
    });

    expect(room.maxPlayers).toBe(8);
  });

  describe("rating-based grouping", () => {
    it("groups players with similar ratings together", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
      });

      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      c1.userData.rank = 1000;
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });
      c2.userData.rank = 1100;
      const c3 = await connectClient(room, { id: "p3", email: "p3@t.com" });
      c3.userData.rank = 1500;
      const c4 = await connectClient(room, { id: "p4", email: "p4@t.com" });
      c4.userData.rank = 1600;

      room.reassignMatchGroups();

      const groups = getGroups(room);
      expect(groups).toHaveLength(2);

      const group1Ids = groups[0].clients.map((c) => c.auth.id);
      const group2Ids = groups[1].clients.map((c) => c.auth.id);

      expect(group1Ids).toEqual(expect.arrayContaining(["p1", "p2"]));
      expect(group2Ids).toEqual(expect.arrayContaining(["p3", "p4"]));
    });

    it("separates players when rating gap exceeds tolerance", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
      });

      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      c1.userData.rank = 1000;
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });
      c2.userData.rank = 2000;

      room.reassignMatchGroups();

      const groups = getGroups(room);
      expect(groups).toHaveLength(2);
      expect(groups[0].clients).toHaveLength(1);
      expect(groups[1].clients).toHaveLength(1);
    });

    it("keeps all players in one group when ratings are close", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
      });

      await Promise.all(
        [1000, 1050, 1100, 1150].map((rank, i) =>
          connectClient(room, {
            id: `p${i + 1}`,
            email: `p${i + 1}@t.com`,
          }).then((c) => {
            c.userData.rank = rank;
          }),
        ),
      );

      room.reassignMatchGroups();

      const groups = getGroups(room);
      expect(groups).toHaveLength(1);
      expect(groups[0].clients).toHaveLength(4);
    });
  });

  describe("minPlayers enforcement", () => {
    it("prevents undersized groups from becoming ready after timeout", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
        countdownCycles: 3,
      });

      // Two players far apart → two groups of 1 each, both < minPlayers(2)
      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      c1.userData.rank = 1000;
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });
      c2.userData.rank = 2000;

      for (let i = 0; i < 20; i++) {
        room.reassignMatchGroups();
      }

      const groups = getGroups(room);
      const readyGroups = groups.filter((g) => g.ready);
      expect(readyGroups).toHaveLength(0);
    });

    it("resets cycle counter for undersized groups so they never reach priority", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
        countdownCycles: 3,
      });

      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      c1.userData.rank = 1000;
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });
      c2.userData.rank = 2000;

      for (let i = 0; i < 20; i++) {
        room.reassignMatchGroups();
      }

      // Cycles should stay low due to repeated resets
      for (const client of room.clients) {
        expect(client.userData.currentCycle).toBeLessThanOrEqual(2);
      }
    });

    it("allows groups meeting minPlayers to become ready after timeout", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
        countdownCycles: 2,
      });

      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      c1.userData.rank = 1000;
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });
      c2.userData.rank = 1100;

      for (let i = 0; i < 10; i++) {
        room.reassignMatchGroups();
      }

      expect(mocks.createGame).toHaveBeenCalled();
    });

    it("creates match room with correct players when group is ready", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
        countdownCycles: 2,
      });

      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      c1.userData.rank = 1000;
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });
      c2.userData.rank = 1100;

      for (let i = 0; i < 10; i++) {
        room.reassignMatchGroups();
      }

      expect(mocks.createGame).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: GameMode.CLASSIC,
          playerIds: expect.arrayContaining(["p1", "p2"]),
          playerPerTeam: 1,
        }),
      );
    });

    it("includes a random seed in grid options when creating game", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.DOMINATION,
        countdownCycles: 2,
      });

      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      c1.userData.rank = 1000;
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });
      c2.userData.rank = 1100;

      for (let i = 0; i < 10; i++) {
        room.reassignMatchGroups();
      }

      expect(mocks.createGame).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: GameMode.DOMINATION,
          gridOptions: expect.objectContaining({
            seed: expect.any(Number),
            flagCount: 3,
          }),
        }),
      );
      expect(mocks.generateSeed).toHaveBeenCalled();
    });
  });

  describe("mode defaults", () => {
    async function triggerMatch(gameMode: GameMode) {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode,
        countdownCycles: 2,
      });

      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      c1.userData.rank = 1000;
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });
      c2.userData.rank = 1100;

      for (let i = 0; i < 10; i++) {
        room.reassignMatchGroups();
      }

      return mocks.createGame.mock.calls[
        mocks.createGame.mock.calls.length - 1
      ][0];
    }

    it("passes finishTick and targetScore for domination mode", async () => {
      const options = await triggerMatch(GameMode.DOMINATION);

      expect(options.mode).toBe(GameMode.DOMINATION);
      expect(options.finishTick).toBe(600);
      expect(options.targetScore).toBe(1000);
    });

    it("passes finishTick for turf_war mode", async () => {
      const options = await triggerMatch(GameMode.TURF_WAR);

      expect(options.mode).toBe(GameMode.TURF_WAR);
      expect(options.finishTick).toBe(360);
      expect(options.targetScore).toBeUndefined();
    });

    it("omits finishTick and targetScore for classic mode", async () => {
      const options = await triggerMatch(GameMode.CLASSIC);

      expect(options.mode).toBe(GameMode.CLASSIC);
      expect(options.finishTick).toBeUndefined();
      expect(options.targetScore).toBeUndefined();
    });
  });

  describe("duplicate connection handling", () => {
    it("kicks old session when same player reconnects", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
      });

      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });
      expect(room.clients.length).toBe(1);

      let oldLeft = false;
      c1.leave = () => {
        oldLeft = true;
      };

      // Same player joins again — should kick old session
      await connectClient(room, { id: "p1", email: "p1@t.com" });

      expect(oldLeft).toBe(true);
    });
  });

  // ── pickColor ──────────────────────────────────────────────

  describe("pickColor", () => {
    it("updates player color on valid pick", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
      });
      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });

      c1.send("pickColor", { color: 0xe74c3c });

      const player = room.state.players.find((p: QueuePlayer) => p.id === "p1");
      expect(player?.color).toBe(0xe74c3c);
    });

    it("rejects invalid color", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
      });
      const c1 = await connectClient(room, { id: "p1", email: "p1@t.com" });

      const sent = captureErrors(c1);
      c1.send("pickColor", { color: 999999 });

      expect(sent).toContain("invalid color");
    });

    it("rejects already taken color", async () => {
      room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
        gameMode: GameMode.CLASSIC,
      });
      await connectClient(room, { id: "p1", email: "p1@t.com" });
      const c2 = await connectClient(room, { id: "p2", email: "p2@t.com" });

      const p1Color = room.state.players.find(
        (p: QueuePlayer) => p.id === "p1",
      )?.color;
      const sent = captureErrors(c2);
      c2.send("pickColor", { color: p1Color });

      expect(sent).toContain("color already taken");
    });
  });

  // ── onAuth ────────────────────────────────────────────────────

  describe("onAuth", () => {
    it("returns decoded data for a valid token", async () => {
      const token = await JWT.sign({
        id: "u1",
        email: "u1@test.com",
        displayName: "Test",
      });

      const result = await MatchQueueRoom.onAuth(token);

      expect(result).toMatchObject({
        id: "u1",
        email: "u1@test.com",
        displayName: "Test",
      });
    });

    it("throws for an invalid token", async () => {
      await expect(
        MatchQueueRoom.onAuth("invalid.token.here"),
      ).rejects.toThrow();
    });
  });
});
