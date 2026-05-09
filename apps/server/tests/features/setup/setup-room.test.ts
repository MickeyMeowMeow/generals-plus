import { GameMode } from "@generals-plus/engine";
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
});
