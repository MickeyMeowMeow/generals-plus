/**
 * Tests for BotBridge — WebSocket client for bot service communication.
 *
 * Focus: player_id routing in handleMessage (the critical fix),
 * sendTickAndWait lifecycle, and pending callback management.
 */

import { BotBridge } from "@generals-plus/ai";
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up a pending callback entry in the bridge (accesses private state). */
function injectPending(
  bridge: BotBridge,
  playerId: string,
  resolve: (action: unknown) => void = vi.fn(),
): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => {}, 30000);
  (bridge as any).pendingCallbacks.set(playerId, { resolve, timer });
  return timer;
}

/** Access the private handleMessage. */
function callHandleMessage(bridge: BotBridge, msg: unknown): void {
  (bridge as any).handleMessage(msg);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BotBridge", () => {
  let bridge: BotBridge;

  afterEach(() => {
    bridge?.dispose();
  });

  // ── handleMessage routing ─────────────────────────────────────

  describe("handleMessage routing", () => {
    it("routes action to the correct player by player_id", () => {
      bridge = new BotBridge("ws://localhost:9999/ws");

      const resolveA = vi.fn();
      const resolveB = vi.fn();
      const timerA = injectPending(bridge, "player_A", resolveA);
      const timerB = injectPending(bridge, "player_B", resolveB);

      // Send action for player_B
      callHandleMessage(bridge, {
        type: "action",
        player_id: "player_B",
        action: { pass: 0, row: 1, col: 2, direction: 0, split: 0 },
      });

      // Only player_B's callback should be resolved
      expect(resolveB).toHaveBeenCalledOnce();
      expect(resolveB).toHaveBeenCalledWith({
        pass: 0,
        row: 1,
        col: 2,
        direction: 0,
        split: 0,
      });
      expect(resolveA).not.toHaveBeenCalled();

      // player_B removed from pending, player_A still registered
      expect((bridge as any).pendingCallbacks.has("player_B")).toBe(false);
      expect((bridge as any).pendingCallbacks.has("player_A")).toBe(true);

      clearTimeout(timerA);
      clearTimeout(timerB);
    });

    it("routes each response to the corresponding player (no cross-talk)", () => {
      bridge = new BotBridge("ws://localhost:9999/ws");

      const resolveA = vi.fn();
      const resolveB = vi.fn();
      const timerA = injectPending(bridge, "p1", resolveA);
      const timerB = injectPending(bridge, "p2", resolveB);

      // Player 1's action
      callHandleMessage(bridge, {
        type: "action",
        player_id: "p1",
        action: { pass: 0, row: 0, col: 0, direction: 1, split: 0 },
      });
      expect(resolveA).toHaveBeenCalledOnce();
      expect(resolveB).not.toHaveBeenCalled();

      // Player 2's action
      callHandleMessage(bridge, {
        type: "action",
        player_id: "p2",
        action: { pass: 0, row: 3, col: 4, direction: 2, split: 1 },
      });
      expect(resolveB).toHaveBeenCalledOnce();

      // Both cleaned up
      expect((bridge as any).pendingCallbacks.size).toBe(0);

      clearTimeout(timerA);
      clearTimeout(timerB);
    });

    it("does not throw for unknown player_id", () => {
      bridge = new BotBridge("ws://localhost:9999/ws");

      expect(() => {
        callHandleMessage(bridge, {
          type: "action",
          player_id: "unknown_player",
          action: null,
        });
      }).not.toThrow();
    });

    it("does not throw when pendingCallbacks is empty", () => {
      bridge = new BotBridge("ws://localhost:9999/ws");

      expect(() => {
        callHandleMessage(bridge, {
          type: "action",
          player_id: "anyone",
          action: null,
        });
      }).not.toThrow();
    });

    it("clears timeout when resolving callback", () => {
      bridge = new BotBridge("ws://localhost:9999/ws");

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      const resolve = vi.fn();
      const timer = injectPending(bridge, "player_X", resolve);

      callHandleMessage(bridge, {
        type: "action",
        player_id: "player_X",
        action: { pass: 1, row: 0, col: 0, direction: 0, split: 0 },
      });

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
      clearTimeoutSpy.mockRestore();
      clearTimeout(timer);
    });
  });

  // ── sendTickAndWait ───────────────────────────────────────────

  describe("sendTickAndWait", () => {
    it("returns null when WebSocket is not connected", async () => {
      bridge = new BotBridge("ws://localhost:9999/ws");

      const result = await bridge.sendTickAndWait("p1", {
        type: "tick",
        player_id: "p1",
        tick: 1,
        grid: { type: "square", width: 10, height: 10 },
        vision: [],
        owned_land_count: 0,
        owned_army_count: 0,
        scoreboard: [],
      });

      expect(result).toBeNull();
    });
  });

  // ── dispose ────────────────────────────────────────────────────

  describe("dispose", () => {
    it("clears all pending callbacks and resolves them with null", () => {
      bridge = new BotBridge("ws://localhost:9999/ws");

      const resolveA = vi.fn();
      const resolveB = vi.fn();
      injectPending(bridge, "p1", resolveA);
      injectPending(bridge, "p2", resolveB);

      bridge.dispose();

      expect(resolveA).toHaveBeenCalledWith(null);
      expect(resolveB).toHaveBeenCalledWith(null);
      expect((bridge as any).pendingCallbacks.size).toBe(0);
    });
  });
});
