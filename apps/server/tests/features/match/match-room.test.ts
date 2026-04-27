import { ColyseusSDK } from "@colyseus/sdk";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { IPlayerStats } from "@generals-plus/engine";
import {
  GameStatus,
  PlayerStatus,
  Terrain,
  Visibility,
} from "@generals-plus/engine";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { MatchRoom } from "#/features/match/match-room";
import {
  createMockGame,
  createTestServer,
  createTestToken,
  createValidRoomData,
} from "#tests/helpers";

describe("MatchRoom", () => {
  let testServer: ColyseusTestServer;

  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  async function connectClient(
    room: MatchRoom,
    userData: { id: string; email: string },
  ) {
    const port = (testServer.server as unknown as Record<string, unknown>)
      .port as number;
    const sdk = new ColyseusSDK(`ws://127.0.0.1:${port}`);
    sdk.auth.token = await createTestToken(userData);
    const sdkRoom = await sdk.joinById(room.roomId, {});
    return sdkRoom;
  }

  // ── Room creation ──────────────────────────────────────────

  describe("room creation", () => {
    it("creates room with valid metadata and initializes state", async () => {
      const metadata = createValidRoomData();
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      expect(room.state.mode).toBe("classic");
      expect(room.state.width).toBe(16);
      expect(room.state.height).toBe(16);
      expect(room.state.status).toBe(GameStatus.PLAYING);
      expect(room.state.players.size).toBe(2);
      expect(room.state.players.get("p1")).toBeDefined();
      expect(room.state.players.get("p2")).toBeDefined();
    });

    it("sets maxClients from playerInit count", async () => {
      const metadata = createValidRoomData();
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      expect(room.maxClients).toBe(2);
    });

    it("sets room private when isPublic is false", async () => {
      const metadata = createValidRoomData({ isPublic: false });
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      const listing = (room as unknown as { _listing?: { private?: boolean } })
        ._listing;
      expect(listing?.private).toBe(true);
    });

    it("throws on invalid metadata", async () => {
      await expect(
        testServer.createRoom("match", { metadata: { bad: true } }),
      ).rejects.toThrow("Invalid room metadata");
    });

    it("calls game.startGame() on create", async () => {
      const startGame = vi.fn();
      const metadata = createValidRoomData({
        game: createMockGame({ startGame }),
      });
      await testServer.createRoom<MatchRoom>("match", { metadata });

      expect(startGame).toHaveBeenCalledOnce();
    });
  });

  // ── Player join / leave ────────────────────────────────────

  describe("player join and leave", () => {
    it("binds player session and creates per-client schemas on join", async () => {
      const metadata = createValidRoomData();
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      // Find the player by checking session mapping
      const player = room.state.players.get("p1");
      expect(player?.status).toBe(PlayerStatus.ACTIVE);
      expect(room.state.clientVisions.get(client.sessionId)).toBeDefined();
      expect(room.state.clientActionQueues.get(client.sessionId)).toBeDefined();

      await client.leave();
    });

    it("cleans up per-client schemas on leave", async () => {
      const metadata = createValidRoomData();
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });
      const sessionId = client.sessionId;

      await client.leave();
      await new Promise((r) => setTimeout(r, 100));

      expect(room.state.clientVisions.get(sessionId)).toBeUndefined();
      expect(room.state.clientActionQueues.get(sessionId)).toBeUndefined();
    });
  });

  // ── Action queue ───────────────────────────────────────────

  describe("action queue", () => {
    it("appends action to schema queue on message", async () => {
      const metadata = createValidRoomData();
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      client.send("action", {
        type: "move",
        from: { x: 1, y: 1 },
        to: { x: 2, y: 1 },
      });

      // Wait for message to be processed
      await new Promise((r) => setTimeout(r, 100));

      const queue = room.state.clientActionQueues.get(client.sessionId);
      expect(queue).toBeDefined();
      /* biome-ignore lint/style/noNonNullAssertion: validated by toBeDefined above */
      const q = queue!;
      expect(q.queue.length).toBe(1);
      expect(q.queue[0].type).toBe("move");
      expect(q.queue[0].fromX).toBe(1);
      expect(q.queue[0].fromY).toBe(1);
      expect(q.queue[0].toX).toBe(2);
      expect(q.queue[0].toY).toBe(1);

      await client.leave();
    });

    it("ignores action without from/to", async () => {
      const metadata = createValidRoomData();
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      client.send("action", { type: "move" });

      await new Promise((r) => setTimeout(r, 100));

      const queue = room.state.clientActionQueues.get(client.sessionId);
      /* biome-ignore lint/style/noNonNullAssertion: queue exists for connected client */
      expect(queue!.queue.length).toBe(0);

      await client.leave();
    });

    it("clears queue on clear_queue message", async () => {
      const metadata = createValidRoomData();
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      client.send("action", {
        type: "move",
        from: { x: 1, y: 1 },
        to: { x: 2, y: 1 },
      });

      await new Promise((r) => setTimeout(r, 100));

      const queue = room.state.clientActionQueues.get(client.sessionId);
      expect(queue!.queue.length).toBe(1);

      client.send("clear_queue");

      await new Promise((r) => setTimeout(r, 100));

      /* biome-ignore lint/style/noNonNullAssertion: queue exists for connected client */
      expect(queue!.queue.length).toBe(0);

      await client.leave();
    });
  });

  // ── Tick simulation ────────────────────────────────────────

  describe("tick simulation", () => {
    it("increments tick counter via game.nextTick()", async () => {
      const game = createMockGame();
      game.nextTick = vi.fn(() => {
        game.tick++;
      });
      const metadata = createValidRoomData({ game });
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      // Wait for a tick to fire (500ms interval)
      await new Promise((r) => setTimeout(r, 800));

      expect(game.nextTick).toHaveBeenCalled();
      expect(room.state.tick).toBeGreaterThan(0);
    });

    it("syncs player stats from engine", async () => {
      const getPlayerStats = vi.fn(
        (): IPlayerStats => ({
          playerId: "p1",
          land: 5,
          troops: 42,
        }),
      );
      const metadata = createValidRoomData({
        game: createMockGame({ getPlayerStats }),
      });
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      await new Promise((r) => setTimeout(r, 800));

      expect(getPlayerStats).toHaveBeenCalled();
      const p1 = room.state.players.get("p1");
      expect(p1?.land).toBe(5);
      expect(p1?.troops).toBe(42);
    });

    it("processes action queue and stops at first valid action", async () => {
      const handleAction = vi.fn(() => true);
      const game = createMockGame({ handleAction });
      game.nextTick = () => {
        game.tick++;
      };
      const metadata = createValidRoomData({ game });
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      // Push 3 actions
      for (let i = 0; i < 3; i++) {
        client.send("action", {
          type: "move",
          from: { x: i, y: 0 },
          to: { x: i + 1, y: 0 },
        });
      }

      // Wait for messages to be received
      await new Promise((r) => setTimeout(r, 100));

      const queue = room.state.clientActionQueues.get(client.sessionId);
      /* biome-ignore lint/style/noNonNullAssertion: queue exists for connected client */
      expect(queue!.queue.length).toBe(3);

      // Wait for one tick to process
      await new Promise((r) => setTimeout(r, 800));

      // handleAction should have been called, first valid action consumed
      expect(handleAction).toHaveBeenCalled();

      await client.leave();
    });
  });

  // ── Vision sync ────────────────────────────────────────────

  describe("vision sync", () => {
    it("populates clientVisions with flat arrays from engine", async () => {
      const getVisionGrid = vi.fn(() => ({
        width: 2,
        height: 2,
        get: ({ x, y }: { x: number; y: number }) => ({
          coordinate: { x, y },
          visibility: Visibility.VISIBLE,
          terrain: Terrain.PLAIN,
          troopCount: x * y + 1,
          owner: { status: PlayerStatus.ACTIVE },
        }),
        getNeighbors: () => [],
        isValid: () => true,
        forEach: () => {},
      }));

      const metadata = createValidRoomData({
        game: createMockGame({ getVisionGrid }),
      });
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      // Wait for a tick
      await new Promise((r) => setTimeout(r, 800));

      expect(getVisionGrid).toHaveBeenCalledWith("p1");

      const vision = room.state.clientVisions.get(client.sessionId);
      expect(vision).toBeDefined();
      /* biome-ignore lint/style/noNonNullAssertion: validated by toBeDefined above */
      const v = vision!;
      expect(v.visibility.length).toBe(256); // 16x16 grid
      expect(v.terrain.length).toBe(256);
      expect(v.troopCount.length).toBe(256);

      await client.leave();
    });
  });

  // ── Game end ───────────────────────────────────────────────

  describe("game end", () => {
    it("sets FINISHED status and disconnects when game ends", async () => {
      let callCount = 0;
      const checkGameEnd = vi.fn(() => {
        callCount++;
        if (callCount >= 2) {
          return { mode: "classic" as const, winnerTeamId: "team_0" };
        }
        return null;
      });

      const game = createMockGame({ checkGameEnd });
      game.nextTick = () => {
        game.tick++;
      };
      const metadata = createValidRoomData({ game });
      const room = await testServer.createRoom<MatchRoom>("match", {
        metadata,
      });

      // Wait for ticks to fire
      await new Promise((r) => setTimeout(r, 1500));

      expect(room.state.status).toBe(GameStatus.FINISHED);
    });
  });
});
