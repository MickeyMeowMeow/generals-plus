import { matchMaker } from "@colyseus/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  CustomRoomAlreadyExistsError,
  createCustomRoom,
  markCustomRoomMatchStarted,
  onSetupRoomDisposed,
  resetCustomRoomsForTesting,
  resolveCustomRoom,
  setCreateSetupRoomForKeyForTesting,
} from "#/features/setup/custom-room-registry";
import type { SetupRoom } from "#/features/setup/setup-room";

// Import helpers to trigger defineServer() side-effect, which registers
// room handlers with matchMaker and sets processId for room creation.
import "#tests/helpers";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("custom room registry", () => {
  afterEach(() => {
    resetCustomRoomsForTesting();
  });

  it("reuses one in-flight setup room creation across concurrent resolves", async () => {
    const recreateDeferred = createDeferred<string>();
    const createdKeys: string[] = [];
    let createCount = 0;
    setCreateSetupRoomForKeyForTesting(async (customRoomKey) => {
      createCount += 1;
      createdKeys.push(customRoomKey);
      if (createCount === 1) return "setup-initial";
      return recreateDeferred.promise;
    });

    const createdRoom = await createCustomRoom("host-1");
    markCustomRoomMatchStarted(
      createdRoom.customRoomKey,
      createdRoom.setupRoomId,
    );

    const resolveA = resolveCustomRoom(createdRoom.customRoomKey, "host-1");
    const resolveB = resolveCustomRoom(createdRoom.customRoomKey, "guest-2");

    await Promise.resolve();

    expect(createCount).toBe(2);
    expect(createdKeys).toEqual([
      createdRoom.customRoomKey,
      createdRoom.customRoomKey,
    ]);

    recreateDeferred.resolve("setup-rematch");

    await expect(resolveA).resolves.toEqual({
      customRoomKey: createdRoom.customRoomKey,
      setupRoomId: "setup-rematch",
      created: true,
    });
    await expect(resolveB).resolves.toEqual({
      customRoomKey: createdRoom.customRoomKey,
      setupRoomId: "setup-rematch",
      created: false,
    });
  });

  it("creates a custom room with a requested key", async () => {
    setCreateSetupRoomForKeyForTesting(async (customRoomKey) => {
      expect(customRoomKey).toBe("my-room");
      return "setup-my-room";
    });

    await expect(createCustomRoom("host-1", "my-room")).resolves.toEqual({
      customRoomKey: "my-room",
      setupRoomId: "setup-my-room",
      created: true,
    });
  });

  it("rejects duplicate requested custom room keys", async () => {
    setCreateSetupRoomForKeyForTesting(async () => "setup-abc");

    await createCustomRoom("host-1", "taken-room");

    await expect(
      createCustomRoom("host-2", "taken-room"),
    ).rejects.toBeInstanceOf(CustomRoomAlreadyExistsError);
  });

  // --- Coverage for lines 29-34: real createSetupRoomForKey implementation ---

  describe("createCustomRoom (real implementation)", () => {
    // Track room IDs created during real implementation tests for cleanup.
    const createdRoomIds: string[] = [];

    afterEach(() => {
      // Disconnect any rooms created via matchMaker to avoid stale state.
      for (const roomId of createdRoomIds) {
        const room = matchMaker.getLocalRoomById(roomId) as
          | SetupRoom
          | undefined;
        if (room) {
          room.disconnect();
        }
      }
      createdRoomIds.length = 0;
    });

    it("creates a setup room via matchMaker when no test override is set", async () => {
      // resetCustomRoomsForTesting is called in the outer afterEach,
      // which restores the real implementation. No test override here.
      const result = await createCustomRoom("owner-1");
      createdRoomIds.push(result.setupRoomId);

      expect(result).toMatchObject({
        created: true,
        customRoomKey: expect.any(String),
        setupRoomId: expect.any(String),
      });

      // Verify the room was actually created in matchMaker.
      const room = matchMaker.getLocalRoomById(result.setupRoomId) as SetupRoom;
      expect(room).toBeDefined();
      expect(room.roomId).toBe(result.setupRoomId);
    });

    it("passes customRoomKey and gameMode to the created room", async () => {
      const result = await createCustomRoom(null);
      createdRoomIds.push(result.setupRoomId);

      const room = matchMaker.getLocalRoomById(result.setupRoomId) as SetupRoom;
      expect(room).toBeDefined();
    });
  });

  // --- Coverage for line 44: activeSetupRoomId early return ---

  it("resolveCustomRoom returns existing activeSetupRoomId without creating a new room", async () => {
    let createCount = 0;
    setCreateSetupRoomForKeyForTesting(async (_customRoomKey) => {
      createCount += 1;
      return "setup-room-1";
    });

    // createCustomRoom sets activeSetupRoomId internally.
    const created = await createCustomRoom("host-1");
    expect(createCount).toBe(1);

    // Do NOT call markCustomRoomMatchStarted -- activeSetupRoomId remains set.
    const resolved = await resolveCustomRoom(created.customRoomKey, "guest-2");

    expect(resolved).toEqual({
      customRoomKey: created.customRoomKey,
      setupRoomId: "setup-room-1",
      created: false,
    });
    // No additional room creation should have occurred.
    expect(createCount).toBe(1);
  });

  // --- Coverage for lines 124-127: onSetupRoomDisposed ---

  describe("onSetupRoomDisposed", () => {
    it("clears activeSetupRoomId and sets status to idle when key and roomId match", async () => {
      setCreateSetupRoomForKeyForTesting(async () => "setup-abc");

      const created = await createCustomRoom("owner-1");

      // Before disposal, verify the record has an active room.
      const resolvedBefore = await resolveCustomRoom(
        created.customRoomKey,
        null,
      );
      expect(resolvedBefore?.created).toBe(false);
      expect(resolvedBefore?.setupRoomId).toBe("setup-abc");

      // Dispose the room.
      onSetupRoomDisposed(created.customRoomKey, "setup-abc");

      // After disposal, resolveCustomRoom should start a new creation
      // (activeSetupRoomId is null, status is "idle").
      let secondCreateCalled = false;
      setCreateSetupRoomForKeyForTesting(async () => {
        secondCreateCalled = true;
        return "setup-def";
      });

      const resolvedAfter = await resolveCustomRoom(
        created.customRoomKey,
        null,
      );
      expect(resolvedAfter?.created).toBe(true);
      expect(resolvedAfter?.setupRoomId).toBe("setup-def");
      expect(secondCreateCalled).toBe(true);
    });

    it("returns early when the key does not exist", () => {
      // Should not throw.
      expect(() =>
        onSetupRoomDisposed("nonexistent-key", "some-room-id"),
      ).not.toThrow();
    });

    it("returns early when the setupRoomId does not match", async () => {
      setCreateSetupRoomForKeyForTesting(async () => "setup-abc");

      const created = await createCustomRoom("owner-1");

      // Call with wrong roomId -- should not modify the record.
      onSetupRoomDisposed(created.customRoomKey, "wrong-room-id");

      // The record should still have its activeSetupRoomId.
      const resolved = await resolveCustomRoom(created.customRoomKey, null);
      expect(resolved?.created).toBe(false);
      expect(resolved?.setupRoomId).toBe("setup-abc");
    });
  });
});
