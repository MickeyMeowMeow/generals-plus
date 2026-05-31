/**
 * Tests for BotSession — bot player lifecycle within a MatchRoom.
 *
 * Focus: register/onTick/end message dispatch, action queuing,
 * and per-player isolation.
 */

import type { BotBridge, GridInfo } from "@generals-plus/ai";
import { BotSession } from "@generals-plus/ai";
import type { IBaseGame, ICellOwner, IVisionCell } from "@generals-plus/engine";
import { PlayerStatus, Terrain, Visibility } from "@generals-plus/engine";
import type { ActionData, MatchState } from "@generals-plus/shared-types";
import { ClientActionQueue, ClientVision } from "@generals-plus/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockBridge = {
  send: ReturnType<typeof vi.fn>;
  sendTickAndWait: ReturnType<typeof vi.fn>;
};

function createMockBridge(overrides?: Partial<MockBridge>): BotBridge {
  return {
    send: vi.fn(),
    sendTickAndWait: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as BotBridge;
}

function createMockVisionCell(overrides?: Partial<IVisionCell>): IVisionCell {
  return {
    coordinate: { x: 0, y: 0 },
    visibility: Visibility.VISIBLE,
    terrain: Terrain.PLAIN,
    troopCount: 0,
    owner: null,
    ...overrides,
  } as IVisionCell;
}

function createMockGame(visionGrid?: IVisionCell[]): IBaseGame {
  // Pass through undefined so the early-return path is testable.
  // When visionGrid is undefined, getVisionGrid returns undefined.
  return {
    getVisionGrid: vi.fn().mockReturnValue(visionGrid),
  } as unknown as IBaseGame;
}

/** Minimal MatchState shape used by BotSession. */
function createMockState(overrides?: {
  tick?: number;
  clientVisions?: Map<string, ClientVision>;
  clientActionQueues?: Map<string, ClientActionQueue>;
}): MatchState {
  return {
    tick: overrides?.tick ?? 0,
    clientVisions: overrides?.clientVisions ?? new Map(),
    clientActionQueues: overrides?.clientActionQueues ?? new Map(),
  } as unknown as MatchState;
}

const DEFAULT_GRID: GridInfo = { type: "square", width: 10, height: 10 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BotSession", () => {
  let session: BotSession;
  let bridge: MockBridge;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── register ──────────────────────────────────────────────────

  describe("register", () => {
    it('sends a "start" message with player_id', () => {
      bridge = createMockBridge();
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const state = createMockState();
      const s2p = new Map();
      const p2s = new Map();

      session.register(state, s2p, p2s);

      expect(bridge.send).toHaveBeenCalledWith({
        type: "start",
        player_id: "bot_1",
        config: {},
      });
    });

    it("registers session-to-player and player-to-session mappings", () => {
      bridge = createMockBridge();
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const state = createMockState();
      const s2p = new Map<string, string>();
      const p2s = new Map<string, string>();

      session.register(state, s2p, p2s);

      expect(s2p.get("bot:bot_1")).toBe("bot_1");
      expect(p2s.get("bot_1")).toBe("bot:bot_1");
    });

    it("creates ClientVision and ClientActionQueue in state", () => {
      bridge = createMockBridge();
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const state = createMockState();
      session.register(state, new Map(), new Map());

      expect(state.clientVisions.get("bot:bot_1")).toBeInstanceOf(ClientVision);
      expect(state.clientActionQueues.get("bot:bot_1")).toBeInstanceOf(
        ClientActionQueue,
      );
    });
  });

  // ── onTick ─────────────────────────────────────────────────────

  describe("onTick", () => {
    it("sends tick message and queues the returned action", async () => {
      const botAction = { pass: 0, row: 1, col: 2, direction: 0, split: 0 };
      bridge = createMockBridge({
        sendTickAndWait: vi.fn().mockResolvedValue(botAction),
      });
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      // Set up state with an action queue
      const queue = new ClientActionQueue();
      const state = createMockState({
        tick: 5,
        clientActionQueues: new Map([["bot:bot_1", queue]]),
      });

      // Create game with a vision cell owned by this bot
      const cell = createMockVisionCell({
        owner: { playerId: "bot_1", status: PlayerStatus.ACTIVE } as ICellOwner,
        troopCount: 10,
      });
      const game = createMockGame([cell]);

      await session.onTick(game, state, []);

      // Should have sent tick
      expect(bridge.sendTickAndWait).toHaveBeenCalledOnce();
      const tickMsg = bridge.sendTickAndWait.mock.calls[0][1];
      expect(tickMsg.type).toBe("tick");
      expect(tickMsg.player_id).toBe("bot_1");
      expect(tickMsg.tick).toBe(5);

      // Should have queued the action
      expect(queue.queue.length).toBe(1);
      const queued = queue.queue[0] as ActionData;
      expect(queued.fromX).toBe(2); // col
      expect(queued.fromY).toBe(1); // row
    });

    it("returns early if getVisionGrid returns falsy", async () => {
      bridge = createMockBridge();
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const game = createMockGame(undefined); // visionGrid is undefined
      const state = createMockState();

      await session.onTick(game, state, []);

      expect(bridge.sendTickAndWait).not.toHaveBeenCalled();
    });

    it("does not queue action when bot returns a pass", async () => {
      bridge = createMockBridge({
        sendTickAndWait: vi.fn().mockResolvedValue({
          pass: 1,
          row: 0,
          col: 0,
          direction: 0,
          split: 0,
        }),
      });
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const queue = new ClientActionQueue();
      const state = createMockState({
        clientActionQueues: new Map([["bot:bot_1", queue]]),
      });
      const game = createMockGame([createMockVisionCell()]);

      await session.onTick(game, state, []);

      expect(queue.queue.length).toBe(0);
    });

    it("does not queue when bot returns null", async () => {
      bridge = createMockBridge({
        sendTickAndWait: vi.fn().mockResolvedValue(null),
      });
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const queue = new ClientActionQueue();
      const state = createMockState({
        clientActionQueues: new Map([["bot:bot_1", queue]]),
      });
      const game = createMockGame([createMockVisionCell()]);

      await session.onTick(game, state, []);

      expect(queue.queue.length).toBe(0);
    });

    it("does not queue when action direction is invalid", async () => {
      bridge = createMockBridge({
        sendTickAndWait: vi.fn().mockResolvedValue({
          pass: 0,
          row: 0,
          col: 0,
          direction: -1,
          split: 0,
        }),
      });
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const queue = new ClientActionQueue();
      const state = createMockState({
        clientActionQueues: new Map([["bot:bot_1", queue]]),
      });
      const game = createMockGame([createMockVisionCell()]);

      await session.onTick(game, state, []);

      expect(queue.queue.length).toBe(0);
    });

    it("counts owned land and army from vision cells", async () => {
      bridge = createMockBridge();
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const state = createMockState({ tick: 3 });
      const cells = [
        createMockVisionCell({
          coordinate: { x: 0, y: 0 },
          owner: {
            playerId: "bot_1",
            status: PlayerStatus.ACTIVE,
          } as ICellOwner,
          troopCount: 5,
        }),
        createMockVisionCell({
          coordinate: { x: 1, y: 0 },
          owner: {
            playerId: "bot_1",
            status: PlayerStatus.ACTIVE,
          } as ICellOwner,
          troopCount: 3,
        }),
        createMockVisionCell({
          coordinate: { x: 2, y: 0 },
          owner: {
            playerId: "other",
            status: PlayerStatus.ACTIVE,
          } as ICellOwner,
          troopCount: 7,
        }),
      ];
      const game = createMockGame(cells);

      await session.onTick(game, state, []);

      const tickMsg = bridge.sendTickAndWait.mock.calls[0][1];
      expect(tickMsg.owned_land_count).toBe(2);
      expect(tickMsg.owned_army_count).toBe(8); // 5 + 3
    });
  });

  // ── end ────────────────────────────────────────────────────────

  describe("end", () => {
    it('sends an "end" message with player_id', () => {
      bridge = createMockBridge();
      session = new BotSession(
        "bot_1",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      session.end();

      expect(bridge.send).toHaveBeenCalledWith({
        type: "end",
        player_id: "bot_1",
      });
    });
  });

  // ── Multiple players isolation ─────────────────────────────────

  describe("multiple player isolation", () => {
    it("two sessions use independent bridge calls with correct player_ids", async () => {
      const bridge = createMockBridge({
        sendTickAndWait: vi
          .fn()
          .mockResolvedValueOnce({
            pass: 0,
            row: 5,
            col: 3,
            direction: 0,
            split: 0,
          })
          .mockResolvedValueOnce({
            pass: 0,
            row: 3,
            col: 4,
            direction: 1,
            split: 0,
          }),
      });

      const sessionA = new BotSession(
        "bot_A",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );
      const sessionB = new BotSession(
        "bot_B",
        bridge as unknown as BotBridge,
        DEFAULT_GRID,
      );

      const queueA = new ClientActionQueue();
      const queueB = new ClientActionQueue();
      const state = createMockState({
        tick: 10,
        clientActionQueues: new Map([
          ["bot:bot_A", queueA],
          ["bot:bot_B", queueB],
        ]),
      });

      const cellA = createMockVisionCell({
        owner: { playerId: "bot_A", status: PlayerStatus.ACTIVE } as ICellOwner,
      });
      const cellB = createMockVisionCell({
        owner: { playerId: "bot_B", status: PlayerStatus.ACTIVE } as ICellOwner,
      });

      // Each session uses its own game (separate vision grid)
      await sessionA.onTick(createMockGame([cellA]), state, []);
      await sessionB.onTick(createMockGame([cellB]), state, []);

      // Both tick messages sent with correct player_ids
      const calls = bridge.sendTickAndWait.mock.calls;
      expect(calls[0][0]).toBe("bot_A");
      expect(calls[0][1].player_id).toBe("bot_A");
      expect(calls[1][0]).toBe("bot_B");
      expect(calls[1][1].player_id).toBe("bot_B");

      // Both queues populated with correct actions
      expect(queueA.queue.length).toBe(1);
      expect(queueB.queue.length).toBe(1);
    });
  });
});
