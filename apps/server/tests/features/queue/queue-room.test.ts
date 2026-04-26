import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { GeneralsQueueRoom } from "#features/queue/queue-room";
import { createTestServer } from "../../helpers";

describe("GeneralsQueueRoom", () => {
  let testServer: ColyseusTestServer;

  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it("creates queue room with classic gameMode", async () => {
    const room = await testServer.createRoom<GeneralsQueueRoom>("queue", {
      gameMode: "classic",
    });

    expect(room).toBeDefined();
    expect(room.roomId).toBeDefined();
  });

  it("creates separate rooms for different gameModes", async () => {
    const room1 = await testServer.createRoom<GeneralsQueueRoom>("queue", {
      gameMode: "classic",
    });
    const room2 = await testServer.createRoom<GeneralsQueueRoom>("queue", {
      gameMode: "blitz",
    });

    expect(room1.roomId).not.toBe(room2.roomId);
  });
});
