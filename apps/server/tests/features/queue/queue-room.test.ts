import { GameMode } from "@generals-plus/engine";
import { afterEach, describe, expect, it } from "vitest";

import type { MatchQueueRoom } from "#/features/queue/queue-room";
import { connectClient, createRoom, ROOM_NAMES } from "#tests/helpers";

describe("MatchQueueRoom", () => {
  let room: MatchQueueRoom;

  afterEach(() => {
    if (room) {
      room.disconnect();
    }
  });

  it("creates queue room with classic gameMode", async () => {
    room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
    });

    expect(room).toBeDefined();
    expect(room.roomId).toBeDefined();
  });

  it("creates separate rooms for different gameModes", async () => {
    const room1 = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
    });
    const room2 = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.TURF_WAR,
    });

    expect(room1.roomId).not.toBe(room2.roomId);

    room1.disconnect();
    room2.disconnect();
  });

  it("does not advance countdown until minPlayers have joined", async () => {
    room = await createRoom<MatchQueueRoom>("queue", {
      gameMode: "classic",
      countdownCycles: 2,
    });

    await connectClient(room, {
      id: "p1",
      email: "p1@test.com",
    });

    expect(room.clients.length).toBe(1);

    for (let i = 0; i < 10; i++) {
      room.reassignMatchGroups();
    }

    expect(room.clients[0].userData.currentCycle).toBe(0);

    await connectClient(room, {
      id: "p2",
      email: "p2@test.com",
    });

    expect(room.clients.length).toBe(2);

    room.reassignMatchGroups();

    expect(room.clients.some((c) => c.userData.currentCycle > 0)).toBe(true);
  });

  it("uses minPlayers as the default match group size", async () => {
    room = await createRoom<MatchQueueRoom>(ROOM_NAMES.QUEUE, {
      gameMode: GameMode.CLASSIC,
    });

    expect(room.maxPlayers).toBe(2);
  });
});
