import { JWT } from "@colyseus/auth";
import type { Client } from "@colyseus/core";
import { matchMaker, Room } from "@colyseus/core";
import type { GameMode } from "@generals-plus/engine";
import type {
  ClientAuth,
  MapGenerator,
  RoomData,
} from "@generals-plus/shared-types";
import {
  ROOM_NAMES,
  SetupPlayer,
  SetupState,
} from "@generals-plus/shared-types";

import { DefaultMapGenerator } from "#features/queue/default-map-generator";

const DEFAULT_MAX_PLAYERS = 8;

interface SetupRoomOptions {
  gameMode?: GameMode;
  maxPlayers?: number;
  isPublic?: boolean;
}

export class SetupRoom extends Room<{ state: SetupState }> {
  private hostId = "";
  private mapGenerator: MapGenerator = new DefaultMapGenerator();

  async onCreate(options: SetupRoomOptions) {
    const gameMode = options.gameMode ?? "classic";
    const maxPlayers = options.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    const isPublic = options.isPublic ?? true;

    this.maxClients = maxPlayers;

    const state = new SetupState();
    state.gameMode = gameMode;
    state.isPublic = isPublic;
    state.maxPlayers = maxPlayers;
    this.state = state;

    if (!isPublic) {
      await this.setPrivate(true);
    }

    await this.setMetadata({ gameMode, isPublic });
  }

  static async onAuth(token: string) {
    return JWT.verify(token);
  }

  async onJoin(client: Client) {
    const auth = client.auth as ClientAuth;
    const id = auth.id;
    const username = auth.username ?? `Player_${this.clients.length + 1}`;

    const isFirst = this.state.players.length === 0;

    const player = new SetupPlayer();
    player.id = id;
    player.username = username;
    player.isHost = isFirst;
    this.state.players.push(player);

    if (isFirst) {
      this.hostId = id;
      this.state.hostId = id;
      await this.setMetadata({
        hostId: id,
        gameMode: this.state.gameMode,
        isPublic: this.state.isPublic,
      });
    }
  }

  onLeave(client: Client) {
    const auth = client.auth as ClientAuth;
    const id = auth.id;
    const isHost = id === this.hostId;

    this.removePlayerFromState(id);

    if (isHost && this.state.players.length > 0) {
      this.transferHost();
    }
  }

  messages = {
    updateSettings: async (
      client: Client,
      message: {
        gameMode?: GameMode;
        maxPlayers?: number;
        isPublic?: boolean;
        mapOptions?: Record<string, unknown>;
      },
    ) => {
      if (!this.isHost(client)) {
        client.send("error", "only the host can update settings");
        return;
      }

      if (message.gameMode) {
        this.state.gameMode = message.gameMode;
      }
      if (message.maxPlayers) {
        this.state.maxPlayers = message.maxPlayers;
        this.maxClients = message.maxPlayers;
      }
      if (message.isPublic !== undefined) {
        this.state.isPublic = message.isPublic;
        await this.setPrivate(!message.isPublic);
      }

      await this.setMetadata({
        hostId: this.hostId,
        gameMode: this.state.gameMode,
        isPublic: this.state.isPublic,
      });
    },

    start: async (client: Client) => {
      if (!this.isHost(client)) {
        client.send("error", "only the host can start the game");
        return;
      }

      if (this.state.players.length < 2) {
        client.send("error", "need at least 2 players to start");
        return;
      }

      await this.startGame();
    },

    kick: (client: Client, message: { playerId: string }) => {
      if (!this.isHost(client)) {
        client.send("error", "only the host can kick players");
        return;
      }

      const target = this.clients.find(
        (c) => (c.auth as ClientAuth).id === message.playerId,
      );
      if (target && target.id !== client.id) {
        target.leave(4000);
      }
    },
  };

  private isHost(client: Client): boolean {
    return (client.auth as ClientAuth)?.id === this.hostId;
  }

  private async startGame() {
    const playerInit = this.state.players.map((p, i) => ({
      id: p.id,
      username: p.username,
      teamId: `team_${i}`,
    }));

    const metadata: RoomData = {
      mode: this.state.gameMode,
      map: this.mapGenerator.generate(this.state.gameMode, playerInit.length),
      playerInit,
      isPublic: false,
    };

    const room = await matchMaker.createRoom(ROOM_NAMES.MATCH, { metadata });

    await matchMaker.reserveMultipleSeatsFor(
      room,
      this.clients.map((c) => ({
        sessionId: c.sessionId,
        options: undefined,
        auth: c.auth,
      })),
    );

    for (const client of this.clients) {
      client.send(
        "seat",
        matchMaker.buildSeatReservation(room, client.sessionId),
      );
    }

    await this.disconnect();
  }

  private transferHost() {
    const newHost = this.state.players.at(0);
    if (!newHost) return;

    newHost.isHost = true;
    this.hostId = newHost.id;
    this.state.hostId = newHost.id;

    this.setMetadata({
      hostId: newHost.id,
      gameMode: this.state.gameMode,
      isPublic: this.state.isPublic,
    });
  }

  private removePlayerFromState(playerId: string) {
    const idx = this.state.players.findIndex((p) => p.id === playerId);
    if (idx !== -1) {
      this.state.players.splice(idx, 1);
    }
  }
}
