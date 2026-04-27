import { JWT } from "@colyseus/auth";
import type { Client } from "@colyseus/core";
import { logger, Room } from "@colyseus/core";
import type { Terrain } from "@generals-plus/engine";
import { PlayerStatus } from "@generals-plus/engine";
import type { ClientAuth, RoomData } from "@generals-plus/shared-types";
import {
  Cell,
  MatchState,
  Player,
  parseRoomData,
} from "@generals-plus/shared-types";

export class MatchRoom extends Room<{
  state: MatchState;
  metadata: RoomData;
}> {
  async onCreate(options: { metadata: unknown }) {
    const metadata = parseRoomData(options.metadata);
    if (!metadata) {
      throw new Error("[MatchRoom] Invalid room metadata");
    }

    if (!metadata.isPublic) {
      await this.setPrivate(true);
    }

    this.maxClients = metadata.playerInit.length;

    const state = new MatchState();
    state.mode = metadata.mode;
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

    logger.info(
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

  // use reservation seat system by colyseus to validate auth before allowing clients to join the room, instead of validating in onAuth
  static async onAuth(token: string, _options: unknown, _context: unknown) {
    // validate the token
    const userdata = await JWT.verify(token);

    // return userdata
    return userdata;
  }

  onJoin(client: Client, _options: unknown) {
    logger.info(`[MatchRoom] ${client.sessionId} joined`);
    const userdata = client.auth as ClientAuth | undefined;

    if (userdata) {
      logger.info(`[MatchRoom] User Joined: ${userdata.username}`);

      const player = this.state.players.get(userdata.id);
      if (player) {
        player.sessionId = client.sessionId;
        player.status = PlayerStatus.ACTIVE;

        logger.info(
          `[MatchRoom] Player ${userdata.username} bound to session ${client.sessionId}`,
        );
      } else {
        logger.warn(
          `[MatchRoom] Error: Player data not found for user: ${userdata.username}`,
        );
      }
    } else {
      logger.warn(
        `[MatchRoom] Joining user not found in room data: ${client.sessionId}`,
      );
    }
    // use userdata to initialize player schema if needed
  }

  onLeave(client: Client, _code?: number) {
    // handle player leaving the room, cleanup, etc.
    logger.info(`[MatchRoom] ${client.sessionId} left`);
  }

  onDispose() {
    // cleanup resources, save state, etc.
    logger.info("[MatchRoom] Room disposed");
  }
}
