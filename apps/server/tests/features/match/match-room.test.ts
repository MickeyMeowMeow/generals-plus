import type { IGameResult, IPlayerState } from "@generals-plus/engine";
import {
  ActionType,
  GameStatus,
  PlayerStatus,
  Terrain,
  Visibility,
} from "@generals-plus/engine";
import type { ClassicScoreboard } from "@generals-plus/shared-types";
import {
  MatchClientMessage,
  MatchServerMessage,
} from "@generals-plus/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MatchRoom } from "#/features/match/match-room";
import {
  connectClient,
  createMockGame,
  createRoom,
  createValidRoomData,
} from "#tests/helpers";

const ratingMocks = vi.hoisted(() => ({
  getRating: vi.fn().mockResolvedValue(1000),
  updateRatings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/infra/db/repositories/MongoUserRepository", () => ({
  MongoUserRepository: class {
    getRating = ratingMocks.getRating;
    updateRatings = ratingMocks.updateRatings;
  },
}));

vi.mock("#/features/rating/rating-service", () => ({
  calculateNewRatings: () => [
    { playerId: "p1", oldRating: 1000, newRating: 1050 },
    { playerId: "p2", oldRating: 1000, newRating: 950 },
  ],
}));

describe("MatchRoom", () => {
  let room: MatchRoom;

  afterEach(async () => {
    if (room) {
      room.disconnect();
    }
  });

  // ── Room creation ──────────────────────────────────────────

  describe("room creation", () => {
    it("creates room with valid metadata and initializes state", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      expect(room.state.mode).toBe("classic");
      expect(room.state.width).toBe(16);
      expect(room.state.height).toBe(16);
      expect(room.state.status).toBe(GameStatus.PLAYING);
      expect(room.state.players.size).toBe(2);
      expect(room.state.publicPlayers.size).toBe(2);
      expect(room.state.players.get("p1")).toBeDefined();
      expect(room.state.players.get("p2")).toBeDefined();
      expect(room.state.publicPlayers.get("p1")?.displayName).toBe("Player1");
      expect(room.state.publicPlayers.get("p2")?.color).toBeDefined();
    });

    it("sets maxClients from playerInit count", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      expect(room.maxClients).toBe(2);
    });

    it("sets room private when isPublic is false", async () => {
      const metadata = createValidRoomData({ isPublic: false });
      room = await createRoom<MatchRoom>("match", { metadata });

      const listing = (room as unknown as { _listing?: { private?: boolean } })
        ._listing;
      expect(listing?.private).toBe(true);
    });

    it("throws on invalid metadata", async () => {
      await expect(
        createRoom("match", { metadata: { bad: true } }),
      ).rejects.toThrow("Invalid room metadata");
    });

    it("calls game.startGame() on create", async () => {
      const startGame = vi.fn();
      const metadata = createValidRoomData({
        game: createMockGame({ startGame }),
      });
      room = await createRoom<MatchRoom>("match", { metadata });

      expect(startGame).toHaveBeenCalledOnce();
    });
  });

  // ── Player join / leave ────────────────────────────────────

  describe("player join and leave", () => {
    it("binds player session and creates per-client schemas on join", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      const player = room.state.players.get("p1");
      expect(player?.status).toBe(PlayerStatus.ACTIVE);
      expect(room.state.clientVisions.get(client.sessionId)).toBeDefined();
      expect(room.state.clientActionQueues.get(client.sessionId)).toBeDefined();
    });

    it("cleans up per-client schemas on leave", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });
      const sessionId = client.sessionId;

      await (
        room as unknown as { _onLeave: (c: unknown) => Promise<void> }
      )._onLeave(client);
      expect(room.state.clientVisions.get(sessionId)).toBeUndefined();
      expect(room.state.clientActionQueues.get(sessionId)).toBeUndefined();
    });
  });

  // ── Action queue ───────────────────────────────────────────

  describe("action queue", () => {
    it("appends action to schema queue on message", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      const msgPromise = room.waitForMessage(MatchClientMessage.ACTION);
      client.send("action", {
        type: "move",
        from: { x: 1, y: 1 },
        to: { x: 2, y: 1 },
      });
      await msgPromise;

      const queue = room.state.clientActionQueues.get(client.sessionId);
      if (!queue) throw new Error("queue not found");
      expect(queue.queue.length).toBe(1);
      expect(queue.queue[0].type).toBe("move");
      expect(queue.queue[0].fromX).toBe(1);
      expect(queue.queue[0].fromY).toBe(1);
      expect(queue.queue[0].toX).toBe(2);
      expect(queue.queue[0].toY).toBe(1);
    });

    it("ignores action without from/to", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      const msgPromise = room.waitForMessage(MatchClientMessage.ACTION);
      client.send("action", { type: "move" });
      await msgPromise;

      const queue = room.state.clientActionQueues.get(client.sessionId);
      if (!queue) throw new Error("queue not found");
      expect(queue.queue.length).toBe(0);
    });

    it("clears queue on clear_queue message", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      const actionPromise = room.waitForMessage(MatchClientMessage.ACTION);
      client.send("action", {
        type: "move",
        from: { x: 1, y: 1 },
        to: { x: 2, y: 1 },
      });
      await actionPromise;

      const queue = room.state.clientActionQueues.get(client.sessionId);
      if (!queue) throw new Error("queue not found");
      expect(queue.queue.length).toBe(1);

      const clearPromise = room.waitForMessage(MatchClientMessage.CLEAR_QUEUE);
      client.send("clear_queue");
      await clearPromise;

      expect(queue.queue.length).toBe(0);
    });
  });

  // ── Tick simulation ────────────────────────────────────────

  describe("tick simulation", () => {
    it("increments tick counter via game.nextTick()", async () => {
      const game = createMockGame();
      game.nextTick = vi.fn(function (this: { tick: number }) {
        this.tick++;
      });
      const metadata = createValidRoomData({ game });
      room = await createRoom<MatchRoom>("match", { metadata });

      await room.waitForNextSimulationTick();

      expect(game.nextTick).toHaveBeenCalled();
      expect(room.state.tick).toBeGreaterThan(0);
    });

    it("syncs player state from engine", async () => {
      const getPlayerState = vi.fn(
        (): IPlayerState => ({
          playerId: "p1",
          teamId: "team_0",
          status: PlayerStatus.ACTIVE,
        }),
      );
      const metadata = createValidRoomData({
        game: createMockGame({ getPlayerState }),
      });
      room = await createRoom<MatchRoom>("match", { metadata });

      await room.waitForNextSimulationTick();

      expect(getPlayerState).toHaveBeenCalled();
      expect(room.state.publicPlayers.get("p1")?.status).toBe(
        PlayerStatus.ACTIVE,
      );
    });

    it("syncs scoreboard from engine on tick", async () => {
      const getScoreboard = vi.fn(() => ({
        mode: "classic" as const,
        players: [
          { playerId: "p1", troops: 10, land: 5, isGeneralAlive: true },
          { playerId: "p2", troops: 3, land: 1, isGeneralAlive: false },
        ],
      }));
      const metadata = createValidRoomData({
        game: createMockGame({ getScoreboard }),
      });
      room = await createRoom<MatchRoom>("match", { metadata });

      await room.waitForNextSimulationTick();

      expect(getScoreboard).toHaveBeenCalled();
      const scoreboard = room.state.scoreboard as ClassicScoreboard;
      expect(scoreboard.mode).toBe("classic");
      expect(scoreboard.players.length).toBe(2);
      expect(scoreboard.players.at(0)).toMatchObject({
        playerId: "p1",
        troops: 10,
        land: 5,
        isGeneralAlive: true,
      });
    });

    it("processes action queue and stops at first valid action", async () => {
      const handleAction = vi.fn(() => true);
      const game = createMockGame({ handleAction });
      game.nextTick = () => {
        game.tick++;
      };
      const metadata = createValidRoomData({ game });
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      // client.send() calls handler synchronously
      for (let i = 0; i < 3; i++) {
        client.send("action", {
          type: "move",
          from: { x: i, y: 0 },
          to: { x: i + 1, y: 0 },
        });
      }

      const queue = room.state.clientActionQueues.get(client.sessionId);
      if (!queue) throw new Error("queue not found");
      expect(queue.queue.length).toBe(3);

      await room.waitForNextSimulationTick();

      expect(handleAction).toHaveBeenCalled();
    });

    it("clears remaining queue on CLEAR_QUEUE action type", async () => {
      const handleAction = vi.fn(() => true);
      const game = createMockGame({ handleAction });
      game.nextTick = () => {
        game.tick++;
      };
      const metadata = createValidRoomData({ game });
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      // Enqueue: move, clear_queue, move
      client.send("action", {
        type: "move",
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
      });
      client.send("action", {
        type: "clear_queue",
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
      });
      client.send("action", {
        type: "move",
        from: { x: 1, y: 0 },
        to: { x: 2, y: 0 },
      });

      const queue = room.state.clientActionQueues.get(client.sessionId);
      if (!queue) throw new Error("queue not found");
      expect(queue.queue.length).toBe(3);

      await room.waitForNextSimulationTick();

      // First move executed, then clear_queue hit → remaining cleared
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });

  // ── Vision sync ────────────────────────────────────────────

  describe("vision sync", () => {
    it("populates clientVisions with flat arrays from engine", async () => {
      const getVisionGrid = vi.fn((playerId: string) => ({
        width: 2,
        height: 2,
        get: ({ x, y }: { x: number; y: number }) => ({
          coordinate: { x, y },
          visibility: Visibility.VISIBLE,
          terrain: Terrain.PLAIN,
          troopCount: x * y + 1,
          owner: { playerId, status: PlayerStatus.ACTIVE },
        }),
        getNeighbors: () => [],
        isValid: () => true,
        forEach: () => {},
      }));

      const metadata = createValidRoomData({
        game: createMockGame({ getVisionGrid }),
      });
      room = await createRoom<MatchRoom>("match", { metadata });

      await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      await room.waitForNextSimulationTick();

      expect(getVisionGrid).toHaveBeenCalledWith("p1");

      let visionFound = false;
      for (const [, vision] of room.state.clientVisions) {
        if (vision.visibility.length === 256) {
          expect(vision.terrain.length).toBe(256);
          expect(vision.troopCount.length).toBe(256);
          visionFound = true;
          break;
        }
      }
      expect(visionFound).toBe(true);
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
      room = await createRoom<MatchRoom>("match", { metadata });

      await room.waitForNextSimulationTick();
      await room.waitForNextSimulationTick();

      expect(room.state.status).toBe(GameStatus.FINISHED);
    });

    it("syncs FINISHED status when engine already ended during tick", async () => {
      const game = createMockGame({
        checkGameEnd: vi.fn(() => null),
        getPlayerState: vi.fn((playerId: string) => ({
          playerId,
          teamId: playerId === "p1" ? "team_0" : "team_1",
          status:
            playerId === "p1" ? PlayerStatus.ACTIVE : PlayerStatus.ELIMINATED,
        })),
      });
      game.nextTick = () => {
        game.tick++;
        game.status = GameStatus.FINISHED;
      };
      const metadata = createValidRoomData({ game });
      room = await createRoom<MatchRoom>("match", { metadata });

      await room.waitForNextSimulationTick();

      expect(room.state.status).toBe(GameStatus.FINISHED);
    });
  });

  // ── Custom tickInterval and finishTick ──────────────────────

  describe("custom tickInterval and finishTick", () => {
    it("sets tickInterval on state from metadata", async () => {
      const metadata = createValidRoomData({ tickInterval: 250 });
      room = await createRoom<MatchRoom>("match", { metadata });

      expect(room.state.tickInterval).toBe(250);
    });

    it("defaults tickInterval to 500 when metadata omits it", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      expect(room.state.tickInterval).toBe(500);
    });

    it("sets finishTick on state from metadata", async () => {
      const metadata = createValidRoomData({
        mode: "turf_war",
        finishTick: 720,
      });
      room = await createRoom<MatchRoom>("match", { metadata });

      expect(room.state.finishTick).toBe(720);
    });

    it("defaults finishTick to undefined when metadata omits it", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      expect(room.state.finishTick).toBeUndefined();
    });
  });

  // ── Player leave / dispose ────────────────────────────────

  describe("player leave and dispose", () => {
    it("surrenders active player on leave", async () => {
      const handleAction = vi.fn(() => true);
      const metadata = createValidRoomData({
        game: createMockGame({ handleAction }),
      });
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      await (
        room as unknown as { _onLeave: (c: unknown) => Promise<void> }
      )._onLeave(client);

      expect(handleAction).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: "p1",
          type: ActionType.SURRENDER,
        }),
      );
    });

    it("cleans up session mappings on leave", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      await (
        room as unknown as { _onLeave: (c: unknown) => Promise<void> }
      )._onLeave(client);

      expect(room.state.clientVisions.get(client.sessionId)).toBeUndefined();
      expect(
        room.state.clientActionQueues.get(client.sessionId),
      ).toBeUndefined();
    });

    it("replaces old session on duplicate connection", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      const c1 = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });
      const oldSessionId = c1.sessionId;

      // Connect same player again — should replace old session
      const c2 = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      // Old session's data should be cleaned up
      expect(room.state.clientVisions.get(oldSessionId)).toBeUndefined();
      expect(room.state.clientActionQueues.get(oldSessionId)).toBeUndefined();

      // New session should have data
      expect(room.state.clientVisions.get(c2.sessionId)).toBeDefined();
      expect(room.state.clientActionQueues.get(c2.sessionId)).toBeDefined();
    });
  });

  // ── Player elimination ──────────────────────────────────────

  describe("player elimination", () => {
    it("removes action queue when player is eliminated", async () => {
      const getPlayerState = vi.fn((playerId: string) => ({
        playerId,
        teamId: playerId === "p1" ? "team_0" : "team_1",
        status:
          playerId === "p1" ? PlayerStatus.ELIMINATED : PlayerStatus.ACTIVE,
      }));
      const game = createMockGame({ getPlayerState });
      game.nextTick = () => {
        game.tick++;
      };
      const metadata = createValidRoomData({ game });
      room = await createRoom<MatchRoom>("match", { metadata });

      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });
      const sessionId = client.sessionId;

      expect(room.state.clientActionQueues.get(sessionId)).toBeDefined();

      await room.waitForNextSimulationTick();

      expect(room.state.clientActionQueues.get(sessionId)).toBeUndefined();
    });
  });

  // ── Game end with no clear winner ───────────────────────────

  describe("game end from engine status", () => {
    it("sets winnerTeamId to null when multiple teams active", async () => {
      const getPlayerState = vi.fn((playerId: string) => ({
        playerId,
        teamId: playerId === "p1" ? "team_0" : "team_1",
        status: PlayerStatus.ACTIVE,
      }));
      const game = createMockGame({
        checkGameEnd: vi.fn(() => null),
        getPlayerState,
      });
      game.nextTick = () => {
        game.tick++;
        game.status = GameStatus.FINISHED;
      };
      const metadata = createValidRoomData({ game });
      room = await createRoom<MatchRoom>("match", { metadata });

      const broadcastData: IGameResult[] = [];
      const origBroadcast = room.broadcast.bind(room);
      room.broadcast = ((type: string, data: unknown) => {
        if (type === MatchServerMessage.GAME_END) {
          broadcastData.push(data as IGameResult);
        }
        return origBroadcast(type, data);
      }) as typeof room.broadcast;

      await room.waitForNextSimulationTick();

      expect(room.state.status).toBe(GameStatus.FINISHED);
      expect(broadcastData).toHaveLength(1);
      expect(broadcastData[0].winnerTeamId).toBeNull();
    });
  });

  // ── Rating update ───────────────────────────────────────────

  describe("rating update", () => {
    it("updates player ratings when game ends with a winner", async () => {
      let callCount = 0;
      const game = createMockGame({
        checkGameEnd: vi.fn(() => {
          callCount++;
          if (callCount >= 2) {
            return { mode: "classic" as const, winnerTeamId: "team_0" };
          }
          return null;
        }),
      });
      game.nextTick = () => {
        game.tick++;
      };
      const metadata = createValidRoomData({ game });
      room = await createRoom<MatchRoom>("match", { metadata });

      await room.waitForNextSimulationTick();
      await room.waitForNextSimulationTick();

      expect(room.state.status).toBe(GameStatus.FINISHED);

      // updateRatings is async and fire-and-forget — wait for mocks
      await vi.waitFor(() => {
        expect(ratingMocks.getRating).toHaveBeenCalled();
      });
      expect(ratingMocks.updateRatings).toHaveBeenCalled();
    });
  });

  // ── onDispose ───────────────────────────────────────────────

  describe("onDispose", () => {
    it("clears session maps on dispose", async () => {
      const metadata = createValidRoomData();
      room = await createRoom<MatchRoom>("match", { metadata });

      await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      const internal = room as unknown as {
        sessionToPlayerId: Map<string, string>;
        playerToSessionId: Map<string, string>;
      };

      expect(internal.sessionToPlayerId.size).toBeGreaterThan(0);
      expect(internal.playerToSessionId.size).toBeGreaterThan(0);

      room.disconnect();
      room = null as unknown as MatchRoom;

      expect(internal.sessionToPlayerId.size).toBe(0);
      expect(internal.playerToSessionId.size).toBe(0);
    });
  });
});
