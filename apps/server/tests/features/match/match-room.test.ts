import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MatchRoom } from "#/features/match/match-room";
import { createTestServer, createValidRoomData } from "#tests/helpers";

describe("MatchRoom", () => {
  let testServer: ColyseusTestServer;

  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it("creates room with valid metadata and initializes state", async () => {
    const metadata = createValidRoomData();
    const room = await testServer.createRoom<MatchRoom>("match", { metadata });

    expect(room.state.mode).toBe("classic");
    expect(room.state.width).toBe(16);
    expect(room.state.height).toBe(16);
    expect(room.state.players.size).toBe(2);
    expect(room.state.players.get("p1")).toBeDefined();
    expect(room.state.players.get("p2")).toBeDefined();
  });

  it("sets maxClients from playerInit count", async () => {
    const metadata = createValidRoomData();
    const room = await testServer.createRoom<MatchRoom>("match", { metadata });

    expect(room.maxClients).toBe(2);
  });

  it("sets room private when isPublic is false", async () => {
    const metadata = createValidRoomData({ isPublic: false });
    const room = await testServer.createRoom<MatchRoom>("match", { metadata });

    const listing = (room as unknown as { _listing?: { private?: boolean } })
      ._listing;
    expect(listing?.private).toBe(true);
  });

  it("throws on invalid metadata", async () => {
    await expect(
      testServer.createRoom("match", { metadata: { bad: true } }),
    ).rejects.toThrow("Invalid room metadata");
  });
});
