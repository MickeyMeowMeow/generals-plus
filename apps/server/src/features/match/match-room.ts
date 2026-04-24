import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import type { Terrain } from "@generals-plus/engine";
import { PlayerStatus } from "@generals-plus/engine";
import { JWT } from "@colyseus/auth";
import {
  Cell,
  MatchState,
  Player,
  parseRoomData,
} from "@generals-plus/shared-types";

export class MatchRoom extends Room<{
  state: MatchState;
}> {
  onCreate(options: { metadata: unknown }) {
    const metadata = parseRoomData(options.metadata);
    if (!metadata) {
      throw new Error("[MatchRoom] Invalid room metadata");
    }

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

  // use reservation seat system by cloyseus to validate auth before allowing clients to join the room, instead of validating in onAuth
  static async onAuth(token: string, _options: unknown, _context: unknown) {
    // validate the token
    const userdata = await JWT.verify(token);

    // return userdata
    return userdata;
  }

  onJoin(client: Client, _options: unknown) {
    console.log(`[MatchRoom] ${client.sessionId} joined`);
    const userdata = client.auth;

    if (userdata) {
      console.log(`[MatchRoom] User Joined: ${userdata.username}`);

      const player = this.state.players.get(userdata.id);
      if (player) {
        player.sessionId = client.sessionId;
        player.status = PlayerStatus.ACTIVE;

        console.log(`[MatchRoom] Player ${userdata.username} bound to session ${client.sessionId}`);
      } else {
        console.log(`[MatchRoom] Error: Player data not found for user: ${userdata.username}`);
      }
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
