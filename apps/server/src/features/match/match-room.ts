import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import type { RoomData, RoomUser } from "@generals-plus/room-types";
import { parseJoinOptions } from "@generals-plus/room-types";

import type { Terrain } from "./schema";
import { Cell, MatchState, Player, PlayerStatus } from "./schema";

export class MatchRoom extends Room<{
  state: MatchState;
  metadata: RoomData;
}> {
  maxClients = 8;
  private users: RoomUser[] = [];

  onCreate(options: { metadata: RoomData }) {
    const { metadata } = options;
    this.users = metadata.players ?? [];

    const state = new MatchState();
    state.mode = metadata.mode as typeof state.mode;
    state.width = metadata.map.width;
    state.height = metadata.map.height;

    for (const cellInit of metadata.map.cells) {
      const cell = new Cell();
      cell.terrain = cellInit.terrain as Terrain;
      cell.isPassable = cellInit.isPassable;
      cell.troopCount = cellInit.troopCount ?? 0;
      cell.ownerIndex = cellInit.ownerIndex ?? -1;
      state.grid.push(cell);
    }

    for (const playerInit of metadata.playerInit) {
      const player = new Player();
      player.id = playerInit.id;
      player.username = playerInit.username;
      player.teamId = playerInit.teamId;
      player.status = PlayerStatus.ACTIVE;
      state.players.set(playerInit.id, player);
    }

    this.state = state;

    console.log(
      "[MatchRoom] Room:",
      this.roomId,
      "mode:",
      state.mode,
      "map:",
      `${state.width}x${state.height}`,
      "players:",
      metadata.playerInit.length,
    );
  }

  onAuth(_client: Client, options: unknown) {
    const joinOptions = parseJoinOptions(options);
    if (!joinOptions) {
      console.log("[MatchRoom] Invalid join payload");
      return false;
    }

    const { username, token } = joinOptions;
    const userdata = this.users.find(
      (user) => user.username === username && user.token === token,
    );
    if (!userdata) {
      console.log(`[MatchRoom] Username not in user list: ${username}`);
      return false;
    }
    return userdata;
  }

  onJoin(client: Client, _options: unknown) {
    console.log(`[MatchRoom] ${client.sessionId} joined`);
    const userdata = client.auth;
    if (userdata) {
      console.log(`[MatchRoom] User Joined: ${userdata.username}`);
    } else {
      console.log(
        `[MatchRoom] Joining user not found in room data: ${client.sessionId}`,
      );
    }
    // use userdata to initialize player schema if needed
  }

  onLeave(client: Client, _code?: number) {
    // handle player leaving the room, cleanup, etc.
    console.log(`[MatchRoom] ${client.sessionId} left`);
  }

  onDispose() {
    // cleanup resources, save state, etc.
    console.log("[MatchRoom] Room disposed");
  }
}
