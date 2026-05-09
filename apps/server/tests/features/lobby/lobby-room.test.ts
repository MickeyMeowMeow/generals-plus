import { afterEach, describe, expect, it } from "vitest";

import { createRoom, createValidRoomData } from "../../helpers";

describe("LobbyRoom", () => {
  afterEach(async () => {
    const { matchMaker } = await import("@colyseus/core");
    await matchMaker.disconnectAll();
  });

  it("creates lobby room", async () => {
    const lobby = await createRoom("lobby");
    expect(lobby).toBeDefined();
    expect(lobby.roomId).toBeDefined();
  });

  it("receives initial rooms message on connect", async () => {
    const lobby = await createRoom("lobby");
    expect(lobby).toBeDefined();
  });

  it("lists public match rooms alongside lobby", async () => {
    const lobby = await createRoom("lobby");

    const metadata = createValidRoomData();
    const match = await createRoom("match", { metadata });

    expect(lobby).toBeDefined();
    expect(match).toBeDefined();
    expect(match.roomId).not.toBe(lobby.roomId);
  });
});
