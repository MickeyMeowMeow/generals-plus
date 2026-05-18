import { afterEach, describe, expect, it } from "vitest";

import {
  createCustomRoom,
  markCustomRoomMatchStarted,
  resetCustomRoomsForTesting,
  resolveCustomRoom,
  setCreateSetupRoomForKeyForTesting,
} from "#/features/setup/custom-room-registry";

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
});
