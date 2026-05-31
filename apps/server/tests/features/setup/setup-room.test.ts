import { GameMode, getDefaultPlayersPerTeam } from "@generals-plus/engine";
import {
  SetupClientMessage,
  SetupServerMessage,
} from "@generals-plus/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SetupRoom } from "#/features/setup/setup-room";
import { connectClient, createRoom, ROOM_NAMES } from "#tests/helpers";

vi.mock("#/features/game/utils", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    createGame: mod.createGame,
    generateSeed: mod.generateSeed,
  };
});

/** Wraps a client's send to capture error messages without breaking room routing. */
function captureErrors(client: {
  send: (type: string, data?: unknown) => void;
}) {
  const sent: string[] = [];
  const originalSend = client.send.bind(client);
  client.send = (type: string, data?: unknown) => {
    if (type === SetupServerMessage.ERROR) {
      sent.push(data as string);
    } else if (type === SetupServerMessage.VALIDATION_FAILED) {
      sent.push((data as { message: string }).message);
    }
    originalSend(type, data);
  };
  return sent;
}

describe("SetupRoom", () => {
  let room: SetupRoom;

  afterEach(async () => {
    vi.restoreAllMocks();
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
    expect(room.state.players.at(0)?.teamId).toMatch(/^setup_team_\d+$/);
    expect(room.state.hostId).toBe("p1");
  });

  it("subsequent players are not host", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
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
    expect(room.state.players.at(1)?.teamId).toBe("setup_team_1");
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
      expect(room.state.duration).toBe(180);
      expect(room.state.finishTick).toBe(360);
    });

    it("computes finishTick from duration multiplier in turf_war", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: "turf_war",
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        duration: 360,
      });
      await msgPromise;

      expect(room.state.duration).toBe(360);
      expect(room.state.finishTick).toBe(720); // 360 * 1000 / 500
    });

    it("resets duration when switching mode without explicit duration", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: "turf_war",
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      // Set duration to 30
      let msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        duration: 30,
      });
      await msgPromise;
      expect(room.state.duration).toBe(30);

      // Switch to domination — duration should reset
      msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        gameMode: "domination",
      });
      await msgPromise;

      expect(room.state.duration).toBe(300);
    });
  });

  // ── Domination mode settings ───────────────────────────────

  describe("domination mode settings", () => {
    it("resets finishTick and flagCount when switching to domination", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        gameMode: "domination",
      });
      await msgPromise;

      expect(room.state.gameMode).toBe("domination");
      expect(room.state.duration).toBe(300);
      expect(room.state.finishTick).toBe(600);
      expect(room.state.flagCount).toBe(3);
      expect(room.state.targetScore).toBe(1000);
    });

    it("computes finishTick from duration multiplier in domination", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: "domination",
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        duration: 600,
      });
      await msgPromise;

      expect(room.state.duration).toBe(600);
      expect(room.state.finishTick).toBe(1200); // 600 * 1000 / 500
    });

    it("allows flagCount update in domination mode", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: "domination",
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        flagCount: 5,
      });
      await msgPromise;

      expect(room.state.flagCount).toBe(5);
    });

    it("rejects flagCount in non-domination mode", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);
      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        flagCount: 3,
      });
      await msgPromise;

      expect(sent).toContain(
        "Flag count is only available in Domination mode.",
      );
    });

    it("allows targetScore update in domination mode", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: "domination",
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        targetScore: 500,
      });
      await msgPromise;

      expect(room.state.targetScore).toBe(500);
    });

    it("rejects targetScore in non-domination mode", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);
      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        targetScore: 500,
      });
      await msgPromise;

      expect(sent).toContain(
        "Target score is only available in Domination mode.",
      );
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

      expect(sent).toContain("Players per team must be less than max players.");
    });

    it("rejects cityRate + mountainRate > 1", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);

      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        cityRate: 0.6,
        mountainRate: 0.5,
      });

      expect(sent).toContain(
        "Mountain rate and city rate must add up to 1.0 or less.",
      );
    });

    it("rejects demolition playersPerTeam below half of maxPlayers", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DEMOLITION,
        maxPlayers: 6,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);

      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 2,
      });

      expect(sent).toContain(
        "Players per team must be at least half of max players in Demolition.",
      );
    });

    it("rejects payload playersPerTeam below half of maxPlayers", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.PAYLOAD,
        maxPlayers: 6,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);

      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 2,
      });

      expect(sent).toContain(
        "Players per team must be at least half of max players in Payload.",
      );
    });

    it("keeps the larger demolition playersPerTeam when maxPlayers changes", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DEMOLITION,
        maxPlayers: 6,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      let msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 5,
      });
      await msgPromise;

      msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        maxPlayers: 8,
      });
      await msgPromise;

      expect(room.state.playersPerTeam).toBe(5);
    });

    it("auto-bumps demolition playersPerTeam when maxPlayers increases", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DEMOLITION,
        maxPlayers: 6,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      expect(room.state.playersPerTeam).toBe(3);

      const sent = captureErrors(room.clients[0]);
      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        maxPlayers: 8,
      });
      await msgPromise;

      expect(sent).not.toContain(
        "Players per team must be at least half of max players in Demolition.",
      );
      expect(room.state.maxPlayers).toBe(8);
      expect(room.state.playersPerTeam).toBe(4);
    });

    it("rejects invalid settings update", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const sent = captureErrors(room.clients[0]);

      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        maxPlayers: "not a number",
      });

      expect(sent.some((s) => s.includes("Max players must be a number"))).toBe(
        true,
      );
    });

    it("allows cityRate + mountainRate summing to exactly 1.0", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        cityRate: 0.5,
        mountainRate: 0.5,
      });
      await msgPromise;

      expect(room.state.cityRate).toBe(0.5);
      expect(room.state.mountainRate).toBe(0.5);
    });

    it("sends validation failed for too_big error", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });
      const sendSpy = vi.spyOn(client, "send");

      const messagePromise = room.waitForMessage(
        SetupClientMessage.UPDATE_SETTINGS,
      );
      client.send(SetupClientMessage.UPDATE_SETTINGS, { mapWidth: 101 });
      await messagePromise;

      expect(sendSpy).toHaveBeenCalledWith(
        SetupServerMessage.VALIDATION_FAILED,
        {
          severity: "warning",
          field: "mapWidth",
          message: "Map width must be at most 100.",
        },
      );
      expect(room.state.mapWidth).not.toBe(101);
    });

    it("sends validation failed for unrecognized field", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      const client = await connectClient(room, {
        id: "p1",
        email: "p1@test.com",
      });
      const sendSpy = vi.spyOn(client, "send");

      const messagePromise = room.waitForMessage(
        SetupClientMessage.UPDATE_SETTINGS,
      );
      client.send(SetupClientMessage.UPDATE_SETTINGS, { unknownField: 42 });
      await messagePromise;

      expect(sendSpy).toHaveBeenCalledWith(
        SetupServerMessage.VALIDATION_FAILED,
        {
          severity: "warning",
          message: "Settings include an unsupported field.",
        },
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

      expect(sent).toContain("Choose one of the available colors.");
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

      expect(sent).toContain("That color is already taken.");
    });
  });

  // ── pickTeam ───────────────────────────────────────────────

  describe("pickTeam", () => {
    it("updates the current player's team when there is capacity", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 2,
      });
      await msgPromise;

      const targetTeamId = room.state.players.at(0)?.teamId;
      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        teamId: targetTeamId,
      });

      expect(room.state.players.at(1)?.teamId).toBe(targetTeamId);
    });

    it("allows players to join an already full team", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const targetTeamId = room.state.players.at(0)?.teamId;
      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        teamId: targetTeamId,
      });

      expect(room.state.players.at(1)?.teamId).toBe(targetTeamId);
    });

    it("starts demolition rooms by balancing attackers and defenders", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DEMOLITION,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      expect(room.state.players.at(0)?.teamId).toBe("attackers");
      expect(room.state.players.at(1)?.teamId).toBe("defenders");
    });

    it("normalizes selected teams when team settings change", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });
      await connectClient(room, { id: "p3", email: "p3@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        maxPlayers: 4,
        playersPerTeam: 2,
      });
      await msgPromise;

      expect(room.state.players.map((player) => player.teamId)).toEqual([
        "setup_team_0",
        "setup_team_0",
        "setup_team_1",
      ]);
    });

    it("rebalances teams only when the current layout becomes invalid", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });
      await connectClient(room, { id: "p3", email: "p3@test.com" });

      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        teamId: room.state.players.at(0)?.teamId,
      });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 1,
      });
      await msgPromise;

      expect(room.state.players.map((player) => player.teamId)).toEqual([
        "setup_team_0",
        "setup_team_1",
        "setup_team_2",
      ]);
    });

    it("keeps the current grouping when team settings change and it remains valid", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });
      await connectClient(room, { id: "p3", email: "p3@test.com" });

      let msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 2,
      });
      await msgPromise;

      expect(room.state.players.map((player) => player.teamId)).toEqual([
        "setup_team_0",
        "setup_team_0",
        "setup_team_1",
      ]);

      msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 3,
      });
      await msgPromise;

      expect(room.state.players.map((player) => player.teamId)).toEqual([
        "setup_team_0",
        "setup_team_0",
        "setup_team_1",
      ]);
    });

    it("creates a new team on request", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        createNew: true,
      });

      expect(room.state.players.at(1)?.teamId).toBe("setup_team_2");
    });

    it("allows players to move into defenders in demolition", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DEMOLITION,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        teamId: "defenders",
      });

      expect(room.state.players.at(1)?.teamId).toBe("defenders");
    });

    it("rejects creating new teams in demolition", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DEMOLITION,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const sent = captureErrors(room.clients[1]);
      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        createNew: true,
      });

      expect(sent).toContain(
        "Demolition teams are fixed to Attackers and Defenders.",
      );
    });

    it("starts payload rooms by balancing team_0 and team_1", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.PAYLOAD,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      expect(room.state.players.at(0)?.teamId).toBe("team_0");
      expect(room.state.players.at(1)?.teamId).toBe("team_1");
    });

    it("allows players to move into team_1 in payload", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.PAYLOAD,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        teamId: "team_1",
      });

      expect(room.state.players.at(1)?.teamId).toBe("team_1");
    });

    it("rejects creating new teams in payload", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.PAYLOAD,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const sent = captureErrors(room.clients[1]);
      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        createNew: true,
      });

      expect(sent).toContain("Payload teams are fixed to Team 1 and Team 2.");
    });

    it("provides correct payloadLeftCount and payloadRightCount based on team player counts", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.PAYLOAD,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });
      await connectClient(room, { id: "p3", email: "p3@test.com" });

      // Move player 2 and player 3 to team_1 (so team_0 has 1 player, team_1 has 2 players)
      room.clients[1].send(SetupClientMessage.PICK_TEAM, { teamId: "team_1" });
      room.clients[2].send(SetupClientMessage.PICK_TEAM, { teamId: "team_1" });

      const options = (
        room as unknown as { getGridOptions(): Record<string, unknown> }
      ).getGridOptions();
      expect(options.payloadLeftCount).toBe(1);
      expect(options.payloadRightCount).toBe(2);
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

    it("host cannot kick themselves", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      let kicked = false;
      room.clients[0].leave = () => {
        kicked = true;
      };

      room.clients[0].send("kick", { playerId: "p1" });

      expect(kicked).toBe(false);
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

      expect(sent).toContain("Need at least 2 players to start.");
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

    it("rejects start when players are assigned to fewer than 2 teams", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 2,
      });
      await msgPromise;

      const targetTeamId = room.state.players.at(0)?.teamId;
      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        teamId: targetTeamId,
      });

      const sent = captureErrors(room.clients[0]);
      room.clients[0].send(SetupClientMessage.START_GAME);

      expect(sent).toContain(
        "The room needs players on at least two teams to start.",
      );
    });

    it("rejects start when any team exceeds capacity", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });
      await connectClient(room, { id: "p3", email: "p3@test.com" });

      const targetTeamId = room.state.players.at(0)?.teamId;
      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        teamId: targetTeamId,
      });

      const sent = captureErrors(room.clients[0]);
      room.clients[0].send(SetupClientMessage.START_GAME);

      expect(sent).toContain(
        "Move players until every team is within the limit.",
      );
    });

    it("uses playersPerTeam as demolition team capacity when starting", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DEMOLITION,
        maxPlayers: 6,
      });

      for (let i = 1; i <= 6; i++) {
        await connectClient(room, {
          id: `p${i}`,
          email: `p${i}@test.com`,
        });
      }

      const msgPromise = room.waitForMessage("updateSettings");
      room.clients[0].send(SetupClientMessage.UPDATE_SETTINGS, {
        playersPerTeam: 4,
      });
      await msgPromise;

      room.clients[1].send(SetupClientMessage.PICK_TEAM, {
        teamId: "attackers",
      });

      const sent = captureErrors(room.clients[0]);
      const seats: unknown[] = [];
      for (const client of room.clients) {
        const originalSend = client.send.bind(client);
        client.send = (type: string, data?: unknown) => {
          if (type === "seat") seats.push(data);
          originalSend(type, data);
        };
      }

      room.clients[0].send(SetupClientMessage.START_GAME);

      await vi.waitFor(
        () => {
          expect(seats).toHaveLength(6);
        },
        { timeout: 5000 },
      );
      expect(sent).not.toContain(
        "Move players until every team is within the limit.",
      );

      room = null as unknown as SetupRoom;
    });

    it("sends validation failed when game creation throws", async () => {
      const gameUtils = await import("#/features/game/utils");
      const spy = vi.spyOn(gameUtils, "createGame");
      spy.mockImplementationOnce(() => {
        throw new Error("grid generation failed");
      });

      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      const sent = captureErrors(room.clients[0]);
      room.clients[0].send(SetupClientMessage.START_GAME);

      await vi.waitFor(
        () => {
          expect(sent.length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );

      expect(sent).toContain(
        "Those map settings cannot start a game. Try a larger map, fewer mountains, or a lower minimum general distance.",
      );

      spy.mockRestore();
    });

    it("starts game in turf_war mode with finishTick", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.TURF_WAR,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      expect(room.state.finishTick).toBeGreaterThan(0);

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

      room.clients[0].send(SetupClientMessage.START_GAME);

      await vi.waitFor(
        () => {
          expect(seats).toHaveLength(2);
        },
        { timeout: 5000 },
      );

      room = null as unknown as SetupRoom;
    });

    it("starts game in domination mode with finishTick and targetScore", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DOMINATION,
      });
      await connectClient(room, { id: "p1", email: "p1@test.com" });
      await connectClient(room, { id: "p2", email: "p2@test.com" });

      expect(room.state.finishTick).toBeGreaterThan(0);
      expect(room.state.targetScore).toBe(1000);

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

    it("sets demolition playersPerTeam to half of maxPlayers rounded up", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {
        gameMode: GameMode.DEMOLITION,
        maxPlayers: 5,
      });

      expect(room.state.playersPerTeam).toBe(3);
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

  // ── seed randomization ─────────────────────────────────────

  describe("seed randomization", () => {
    it("uses a random seed instead of the fixed default", async () => {
      room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});

      // The old fixed seed was 20260428 — the new seed should be different
      // (collision probability is astronomically low).
      expect(room.state.seed).not.toBe(20260428);
    });

    it("generates different seeds for different rooms", async () => {
      const room1 = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});
      const room2 = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});

      expect(room1.state.seed).not.toBe(room2.state.seed);

      room1.disconnect();
      room2.disconnect();
    });
  });

  it("sends validationFailed for invalid setup settings without changing state", async () => {
    room = await createRoom<SetupRoom>(ROOM_NAMES.SETUP, {});

    const client = await connectClient(room, {
      id: "p1",
      email: "p1@test.com",
    });
    const sendSpy = vi.spyOn(client, "send");

    const messagePromise = room.waitForMessage(
      SetupClientMessage.UPDATE_SETTINGS,
    );
    client.send(SetupClientMessage.UPDATE_SETTINGS, { maxPlayers: 1 });
    await messagePromise;

    expect(sendSpy).toHaveBeenCalledWith(SetupServerMessage.VALIDATION_FAILED, {
      severity: "warning",
      field: "maxPlayers",
      message: "Max players must be at least 2.",
    });
    expect(room.state.maxPlayers).toBe(8);
  });
});
