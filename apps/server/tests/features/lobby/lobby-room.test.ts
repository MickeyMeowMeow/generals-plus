import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestServer, createValidRoomData } from "../../helpers";

describe("LobbyRoom", () => {
  let testServer: ColyseusTestServer;

  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it("connects client to lobby room", async () => {
    const lobby = await testServer.createRoom("lobby");
    const client = await testServer.connectTo(lobby);
    const initialRooms = await client.waitForMessage("rooms", 3000);

    expect(client).toBeDefined();
    expect(client.sessionId).toBeDefined();
    expect(initialRooms).toBeDefined();
    await client.leave();
  });

  it("receives initial rooms message on connect", async () => {
    const lobby = await testServer.createRoom("lobby");
    const client = await testServer.connectTo(lobby);

    const message = await client.waitForMessage("rooms", 3000);
    expect(message).toBeDefined();
    await client.leave();
  });

  it("receives room update when a new public match is created", async () => {
    const lobby = await testServer.createRoom("lobby");
    const client = await testServer.connectTo(lobby);

    // Wait for initial rooms message
    await client.waitForMessage("rooms", 3000);

    // Create a public match room
    const metadata = createValidRoomData();
    await testServer.createRoom("match", { metadata });

    // Lobby should receive a "+" message for the new room
    const message = await client.waitForMessage("+", 3000);
    expect(message).toBeDefined();
    await client.leave();
  });
});
