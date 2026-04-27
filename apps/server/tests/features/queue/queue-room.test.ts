import { ColyseusSDK } from "@colyseus/sdk";
import type { ColyseusTestServer } from "@colyseus/testing";
import { GameMode } from "@generals-plus/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MatchQueueRoom } from "#/features/queue/queue-room";
import { createTestServer, createTestToken, ROOM_NAMES } from "#tests/helpers";

describe("MatchQueueRoom", () => {
  let testServer: ColyseusTestServer;

  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it("creates queue room with classic gameMode", async () => {
    const room = await testServer.createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
    });

    expect(room).toBeDefined();
    expect(room.roomId).toBeDefined();
  });

  it("creates separate rooms for different gameModes", async () => {
    const room1 = await testServer.createRoom<MatchQueueRoom>(
      ROOM_NAMES.QUEUE,
      {
        gameMode: GameMode.CLASSIC,
      },
    );
    const room2 = await testServer.createRoom<MatchQueueRoom>(
      ROOM_NAMES.QUEUE,
      {
        gameMode: GameMode.TURF_WAR,
      },
    );

    expect(room1.roomId).not.toBe(room2.roomId);
  });

  it("does not advance countdown until minPlayers have joined", async () => {
    const room = await testServer.createRoom<MatchQueueRoom>("queue", {
      gameMode: "classic",
      countdownCycles: 2,
    });

    const port = (testServer.server as unknown as Record<string, unknown>)
      .port as number;

    const sdk1 = new ColyseusSDK(`ws://127.0.0.1:${port}`);
    sdk1.auth.token = await createTestToken({ id: "p1", email: "p1@test.com" });
    await sdk1.joinById(room.roomId, { rank: 0 });

    expect(room.clients.length).toBe(1);

    for (let i = 0; i < 10; i++) {
      room.reassignMatchGroups();
    }

    expect(room.clients[0].userData.currentCycle).toBe(0);

    const sdk2 = new ColyseusSDK(`ws://127.0.0.1:${port}`);
    sdk2.auth.token = await createTestToken({ id: "p2", email: "p2@test.com" });
    await sdk2.joinById(room.roomId, { rank: 0 });

    expect(room.clients.length).toBe(2);

    room.reassignMatchGroups();

    expect(room.clients.some((c) => c.userData.currentCycle > 0)).toBe(true);
  });
});
