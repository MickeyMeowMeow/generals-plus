// @vitest-environment node

import {
  MatchClientMessage,
  MatchServerMessage,
} from "@generals-plus/shared-types";
import { afterEach, describe, expect, it } from "vitest";

import type { MatchRoom } from "#/features/match/match-room";
import { connectClient, createRoom, createValidRoomData } from "#tests/helpers";

describe("MatchRoom Pings", () => {
  let room: MatchRoom;

  afterEach(async () => {
    if (room) {
      room.disconnect();
    }
  });

  it("broadcasts valid pings to players on the same team", async () => {
    const metadata = createValidRoomData();
    metadata.playerInit[0].teamId = "team_alpha";
    metadata.playerInit[1].teamId = "team_alpha";

    room = await createRoom<MatchRoom>("match", { metadata });

    const client1 = await connectClient(room, {
      id: "p1",
      email: "p1@alpha.com",
    });

    const client2 = await connectClient(room, {
      id: "p2",
      email: "p2@alpha.com",
    });

    const received1: Array<{ type: string; data: unknown }> = [];
    const originalSend1 = client1.send;
    client1.send = (type: string, data?: unknown) => {
      received1.push({ type, data });
    };

    const received2: Array<{ type: string; data: unknown }> = [];
    client2.send = (type: string, data?: unknown) => {
      received2.push({ type, data });
    };

    const msgPromise = room.waitForMessage(MatchServerMessage.PING);
    originalSend1.call(client1, MatchClientMessage.PING, {
      x: 5,
      y: 10,
      type: "attack",
    });
    await msgPromise;

    const pings = received2.filter((m) => m.type === MatchServerMessage.PING);
    expect(pings.length).toBe(1);
    expect(pings[0].data).toEqual({
      playerId: "p1",
      x: 5,
      y: 10,
      type: "attack",
    });
  });

  it("does not broadcast pings to players on different teams", async () => {
    const metadata = createValidRoomData();
    metadata.playerInit[0].teamId = "team_alpha";
    metadata.playerInit[1].teamId = "team_beta";

    room = await createRoom<MatchRoom>("match", { metadata });

    const client1 = await connectClient(room, {
      id: "p1",
      email: "p1@alpha.com",
    });

    const client2 = await connectClient(room, {
      id: "p2",
      email: "p2@beta.com",
    });

    const received1: Array<{ type: string; data: unknown }> = [];
    const originalSend1 = client1.send;
    client1.send = (type: string, data?: unknown) => {
      received1.push({ type, data });
    };

    const received2: Array<{ type: string; data: unknown }> = [];
    client2.send = (type: string, data?: unknown) => {
      received2.push({ type, data });
    };

    const msgPromise = room.waitForMessage(MatchServerMessage.PING);
    originalSend1.call(client1, MatchClientMessage.PING, {
      x: 2,
      y: 3,
      type: "defense",
    });
    await msgPromise;

    const pings = received2.filter((m) => m.type === MatchServerMessage.PING);
    expect(pings.length).toBe(0);
  });

  it("ignores pings with invalid coordinates or invalid types", async () => {
    const metadata = createValidRoomData();
    metadata.playerInit[0].teamId = "team_alpha";
    metadata.playerInit[1].teamId = "team_alpha";

    room = await createRoom<MatchRoom>("match", { metadata });

    const client1 = await connectClient(room, {
      id: "p1",
      email: "p1@alpha.com",
    });

    const client2 = await connectClient(room, {
      id: "p2",
      email: "p2@alpha.com",
    });

    const received1: Array<{ type: string; data: unknown }> = [];
    const originalSend1 = client1.send;
    client1.send = (type: string, data?: unknown) => {
      received1.push({ type, data });
    };

    const received2: Array<{ type: string; data: unknown }> = [];
    client2.send = (type: string, data?: unknown) => {
      received2.push({ type, data });
    };

    // Send invalid type (should be ignored)
    originalSend1.call(client1, MatchClientMessage.PING, {
      x: 2,
      y: 3,
      type: "cheat",
    });

    // Send out of bounds X (should be ignored)
    originalSend1.call(client1, MatchClientMessage.PING, {
      x: 999,
      y: 3,
      type: "rally",
    });

    // Send out of bounds Y (should be ignored)
    originalSend1.call(client1, MatchClientMessage.PING, {
      x: 2,
      y: -5,
      type: "rally",
    });

    // Send invalid types
    originalSend1.call(client1, MatchClientMessage.PING, {
      x: 2,
      y: 3,
      type: 42,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const pings = received2.filter((m) => m.type === MatchServerMessage.PING);
    expect(pings.length).toBe(0);
  });
});
