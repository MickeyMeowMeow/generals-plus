import { GameMode, getDefaultPlayersPerTeam } from "@generals-plus/engine";
import { SetupClientMessage } from "@generals-plus/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SetupRoom } from "#/features/setup/setup-room";
import { connectClient, createRoom, ROOM_NAMES } from "#tests/helpers";

/** Wraps a client's send to capture error messages without breaking room routing. */
function captureErrors(client: {
  send: (type: string, data?: unknown) => void;
}) {
  const sent: string[] = [];
  const originalSend = client.send.bind(client);
  client.send = (type: string, data?: unknown) => {
    if (type === "error") sent.push(data as string);
    originalSend(type, data);
  };
  return sent;
}

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

    it("updates maxClients when maxPlayers changes", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        maxPlayers: 4,
      });
      await msgPromise;

      expect(room.state.maxPlayers).toBe(4);
      expect(room.maxClients).toBe(4);
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

  // ── Settings update: validation ────────────────────────────

  describe("settings validation", () => {
    it("rejects update from non-host", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const sent = captureErrors(room.clients[1]);

      room.clients[1].send(SetupClientMessage.UPDATE_SETTINGS, {
        maxPlayers: 4,
      });

      expect(sent).toContain("only the host can update settings");
    });

    it("rejects playersPerTeam >= maxPlayers", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);

      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        maxPlayers: 2,
        playersPerTeam: 2,
      });

      expect(sent).toContain("playersPerTeam must be less than maxPlayers");
    });

    it("rejects cityRate + mountainRate > 1", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);

      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        cityRate: 0.6,
        mountainRate: 0.5,
      });

      expect(sent).toContain("cityRate + mountainRate cannot exceed 1.0");
    });

    it("rejects invalid settings update", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);

      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        maxPlayers: "not a number",
      });

      expect(sent.some((s) => s.includes("invalid settings update"))).toBe(
        true,
      );
    });
  });

  // ── pickColor ──────────────────────────────────────────────

  describe("pickColor", () => {
    it("updates player color on valid pick", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      room.clients[0].send(SetupClientMessage.PICK_COLOR, {
        color: 0xe74c3c,
      });

      expect(room.state.players.at(0)?.color).toBe(0xe74c3c);
    });

    it("rejects invalid color", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);

      room.clients[0].send(SetupClientMessage.PICK_COLOR, {
        color: 999999,
      });

      expect(sent).toContain("invalid color");
    });

    it("rejects already taken color", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const sent = captureErrors(room.clients[1]);

      const p1Color = room.state.players.at(0)?.color;
      room.clients[1].send(SetupClientMessage.PICK_COLOR, {
        color: p1Color,
      });

      expect(sent).toContain("color already taken");
    });
  });

  // ── kick ───────────────────────────────────────────────────

  describe("kick", () => {
    it("host can kick another player", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      const c2 = await connectClient(room, { id: "p2", email: "p2@test.com" });

      let left = false;
      c2.leave = () => {
        left = true;
      };

      room.clients[0].send("kick", { playerId: "p2" });

      expect(left).toBe(true);
    });

    it("non-host cannot kick", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const sent = captureErrors(room.clients[1]);

      room.clients[1].send("kick", { playerId: "p1" });

      expect(sent).toContain("only the host can kick players");
    });
  });

  // ── start ──────────────────────────────────────────────────

  describe("start", () => {
    it("rejects start from non-host", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const sent = captureErrors(room.clients[1]);
      room.clients[1].send(SetupClientMessage.START_GAME);

      expect(sent).toContain("only the host can start the game");
    });

    it("rejects start with fewer than 2 players", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);
      room.clients[0].send(SetupClientMessage.START_GAME);

      expect(sent).toContain("need at least 2 players to start");
    });

    it("creates match room and sends seats on successful start", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const seats: unknown[] = [];
      for (const c of room.clients) {
        const origSend = c.send.bind(c);
        (
          c as unknown as {
            send: (type: string, data?: unknown) => void;
          }
        ).send = (type, data) => {
          if (type === "seat") seats.push(data);
          origSend(type, data);
        };
      }

      // Trigger start through the message handler to cover the full path
      room.clients[0].send(SetupClientMessage.START_GAME);

      await vi.waitFor(
        () => {
          expect(seats).toHaveLength(2);
        },
        { timeout: 5000 },
      );

      room = null as unknown as SetupRoom;
    });
  });

  // ── onCreate with gameMode ─────────────────────────────────

  describe("onCreate with gameMode option", () => {
    it("creates room with turf_war gameMode", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.TURF_WAR,
      });

      expect(room.state.gameMode).toBe(GameMode.TURF_WAR);
    });

    it("sets playersPerTeam based on gameMode default", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.TURF_WAR,
      });

      expect(room.state.playersPerTeam).toBe(
        getDefaultPlayersPerTeam(GameMode.TURF_WAR),
      );
    });
  });

  // ── duplicate connection ───────────────────────────────────

  describe("duplicate connection handling", () => {
    it("kicks old session when same player reconnects", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      const c1 = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });

      let oldLeft = false;
      c1.leave = () => {
        oldLeft = true;
      };

      await connectClient(room, { id: "p1", email: "p1@test.com" });
      expect(oldLeft).toBe(true);
    });
  });
});
