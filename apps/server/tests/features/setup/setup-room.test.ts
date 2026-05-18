import { GameMode } from "@generals-plus/engine";
import { SetupClientMessage } from "@generals-plus/shared-types";
import { afterEach, describe, expect, it } from "vitest";

import type { SetupRoom } from "#/features/setup/setup-room";
import { connectClient, createRoom, ROOM_NAMES } from "#tests/helpers";

describe("SetupRoom", () => {
  let room: SetupRoom;

  afterEach(async () => {
    if (room) {
      room.disconnect();
    }
  });

  it("creates room with default settings", async () => {
    room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});

    expect(room.state.gameMode).toBe(GameMode.CLASSIC);
    expect(room.state.isPublic).toBe(true);
    expect(room.state.maxPlayers).toBe(8);
    expect(room.state.playersPerTeam).toBe(1);
    expect(room.state.players.length).toBe(0);
  });

  it("creates private room when isPublic is false", async () => {
    room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
      isPublic: false,
    });

    const listing = (room as unknown as { _listing?: { private?: boolean } })
      ._listing;
    expect(listing?.private).toBe(true);
  });

  it("first player becomes host", async () => {
    room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});

    await connectClient(room, {
      id: "p1",
      email: "p1@test.com",
    });

    expect(room.state.players.length).toBe(1);
    expect(room.state.players.at(0)?.isHost).toBe(true);
    expect(room.state.hostId).toBe("p1");
  });

  it("subsequent players are not host", async () => {
    room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});

    await connectClient(room, {
      id: "p1",
      email: "p1@test.com",
    });
    await connectClient(room, {
      id: "p2",
      email: "p2@test.com",
    });

    expect(room.state.players.length).toBe(2);
    expect(room.state.players.at(1)?.isHost).toBe(false);
  });

  it("transfers host when host leaves", async () => {
    room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});

    const c1 = await connectClient(room, {
      id: "p1",
      email: "p1@test.com",
    });
    await connectClient(room, {
      id: "p2",
      email: "p2@test.com",
    });

    await (
      room as unknown as { _onLeave: (c: unknown) => Promise<void> }
    )._onLeave(c1);

    expect(room.state.players.length).toBe(1);
    expect(room.state.hostId).toBe("p2");
    expect(room.state.players.at(0)?.isHost).toBe(true);
  });

  it("room survives with one player after host transfer", async () => {
    room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});

    const c1 = await connectClient(room, {
      id: "p1",
      email: "p1@test.com",
    });
    const c2 = await connectClient(room, {
      id: "p2",
      email: "p2@test.com",
    });

    await (
      room as unknown as { _onLeave: (c: unknown) => Promise<void> }
    )._onLeave(c1);

    expect(room.state.players.length).toBe(1);
    expect(room.state.hostId).toBe("p2");

    await (
      room as unknown as { _onLeave: (c: unknown) => Promise<void> }
    )._onLeave(c2);
  });

  // ── Settings update: speed / tickInterval ──────────────────

  describe("speed and tickInterval", () => {
    it("computes tickInterval from speed multiplier", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      room.state.speed = 2;
      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, { speed: 2 });
      await msgPromise;

      expect(room.state.speed).toBe(2);
      expect(room.state.tickInterval).toBe(250); // 500 / 2
    });

    it("defaults tickInterval to 500 at speed 1", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      expect(room.state.speed).toBe(1);
      expect(room.state.tickInterval).toBe(500);
    });
  });

  // ── Settings update: duration / finishTick ─────────────────

  describe("duration and finishTick", () => {
    it("resets duration and finishTick when switching to turf_war", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        gameMode: "turf_war",
      });
      await msgPromise;

      expect(room.state.gameMode).toBe("turf_war");
      expect(room.state.duration).toBe(1);
      expect(room.state.finishTick).toBe(360);
    });

    it("computes finishTick from duration multiplier in turf_war", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: "turf_war",
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        duration: 2,
      });
      await msgPromise;

      expect(room.state.duration).toBe(2);
      expect(room.state.finishTick).toBe(720); // 360 * 2
    });

    it("resets duration when switching mode without explicit duration", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: "turf_war",
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      // Set duration to 3
      let msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        duration: 3,
      });
      await msgPromise;
      expect(room.state.duration).toBe(3);

      // Switch to classic — duration should reset
      msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        gameMode: "classic",
      });
      await msgPromise;

      expect(room.state.duration).toBe(1);
    });
  });
});
