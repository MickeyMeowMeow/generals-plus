import { ColyseusSDK } from "@colyseus/sdk";
import type { ColyseusTestServer } from "@colyseus/testing";
import { GameMode } from "@generals-plus/engine";
import { RoomNames } from "@generals-plus/shared-types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SetupRoom } from "#/features/setup/setup-room";
import { createTestServer, createTestToken } from "#tests/helpers";

describe("SetupRoom", () => {
  let testServer: ColyseusTestServer;

  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it("creates room with default settings", async () => {
    const room = await testServer.createRoom<SetupRoom>(RoomNames.SETUP, {});

    expect(room.state.gameMode).toBe(GameMode.CLASSIC);
    expect(room.state.isPublic).toBe(true);
    expect(room.state.maxPlayers).toBe(8);
    expect(room.state.players.length).toBe(0);
  });

  it("creates private room when isPublic is false", async () => {
    const room = await testServer.createRoom<SetupRoom>(RoomNames.SETUP, {
      isPublic: false,
    });

    const listing = (room as unknown as { _listing?: { private?: boolean } })
      ._listing;
    expect(listing?.private).toBe(true);
  });

  async function connectClient(
    testServer: ColyseusTestServer,
    room: SetupRoom,
    userData: { id: string; email: string },
  ) {
    const port = (testServer.server as unknown as Record<string, unknown>)
      .port as number;
    const sdk = new ColyseusSDK(`ws://127.0.0.1:${port}`);
    sdk.auth.token = await createTestToken(userData);
    const sdkRoom = await sdk.joinById(room.roomId, {});
    return sdkRoom;
  }

  it("first player becomes host", async () => {
    const room = await testServer.createRoom<SetupRoom>(RoomNames.SETUP, {});

    const c1 = await connectClient(testServer, room, {
      id: "p1",
      email: "p1@test.com",
    });

    expect(room.state.players.length).toBe(1);
    expect(room.state.players.at(0)?.isHost).toBe(true);
    expect(room.state.hostId).toBe("p1");

    await c1.leave();
  });

  it("subsequent players are not host", async () => {
    const room = await testServer.createRoom<SetupRoom>(RoomNames.SETUP, {});

    const c1 = await connectClient(testServer, room, {
      id: "p1",
      email: "p1@test.com",
    });
    const c2 = await connectClient(testServer, room, {
      id: "p2",
      email: "p2@test.com",
    });

    expect(room.state.players.length).toBe(2);
    expect(room.state.players.at(1)?.isHost).toBe(false);

    await c1.leave();
    await c2.leave();
  });

  it("transfers host when host leaves", async () => {
    const room = await testServer.createRoom<SetupRoom>(RoomNames.SETUP, {});

    const c1 = await connectClient(testServer, room, {
      id: "p1",
      email: "p1@test.com",
    });
    const c2 = await connectClient(testServer, room, {
      id: "p2",
      email: "p2@test.com",
    });

    await c1.leave();

    // Wait for leave to process
    await new Promise((r) => setTimeout(r, 100));

    expect(room.state.players.length).toBe(1);
    expect(room.state.hostId).toBe("p2");
    expect(room.state.players.at(0)?.isHost).toBe(true);

    await c2.leave();
  });

  it("room survives with one player after host transfer", async () => {
    const room = await testServer.createRoom<SetupRoom>(RoomNames.SETUP, {});

    const c1 = await connectClient(testServer, room, {
      id: "p1",
      email: "p1@test.com",
    });
    const c2 = await connectClient(testServer, room, {
      id: "p2",
      email: "p2@test.com",
    });

    await c1.leave();
    await new Promise((r) => setTimeout(r, 100));

    // Room still exists with one player
    expect(room.state.players.length).toBe(1);
    expect(room.state.hostId).toBe("p2");

    await c2.leave();
  });
});
