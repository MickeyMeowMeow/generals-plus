import { JWT } from "@colyseus/auth";
import type { Client } from "@colyseus/core";
import { logger, matchMaker, Room } from "@colyseus/core";
import type { GridGeneratorOptions } from "@generals-plus/engine";
import { DefaultGridGeneratorOptions, GameMode } from "@generals-plus/engine";
import type { ClientAuth, RoomData } from "@generals-plus/shared-types";
import {
  isPaletteColor,
  nextAvailableColor,
  ROOM_NAMES,
  SetupPlayer,
  SetupState,
} from "@generals-plus/shared-types";

import { createGame } from "#/features/game-factory";

const DEFAULT_MAX_PLAYERS = 8;

const MIN_MAP_DIM = 5;
const MAX_MAP_DIM = 100;

interface SetupRoomOptions {
  gameMode?: GameMode;
  maxPlayers?: number;
  isPublic?: boolean;
}

interface UpdateSettingsMessage {
  gameMode?: GameMode;
  maxPlayers?: number;
  isPublic?: boolean;
  mapWidth?: number;
  mapHeight?: number;
  seed?: number;
  mountainRate?: number;
  cityRate?: number;
}

export class SetupRoom extends Room<{ state: SetupState }> {
  private hostId = "";

  async onCreate(options: SetupRoomOptions) {
    const gameMode = options.gameMode ?? GameMode.CLASSIC;
    const maxPlayers = options.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    const isPublic = options.isPublic ?? true;

    this.maxClients = maxPlayers;

    const state = new SetupState();
    state.gameMode = gameMode;
    state.isPublic = isPublic;
    state.maxPlayers = maxPlayers;
    state.mapWidth = DefaultGridGeneratorOptions.width;
    state.mapHeight = DefaultGridGeneratorOptions.height;
    state.seed = DefaultGridGeneratorOptions.seed;
    state.mountainRate = DefaultGridGeneratorOptions.mountainRate;
    state.cityRate = DefaultGridGeneratorOptions.cityRate;
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

    // Deduplicate: if this player_id already has a connection, kick the old one.
    const existingClient = this.clients.find(
      (c) =>
        c.sessionId !== client.sessionId && (c.auth as ClientAuth).id === id,
    );
    if (existingClient) {
      logger.info(
        `[SetupRoom] Duplicate connection for ${username}, kicking old session ${existingClient.sessionId}`,
      );
      existingClient.leave(4000);
    }

    const isFirst = this.state.players.length === 0;

    const player = new SetupPlayer();
    player.id = id;
    player.username = username;
    player.isHost = isFirst;
    player.color =
      nextAvailableColor(this.state.players.map((p) => p.color)) ?? 0;
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
    updateSettings: async (client: Client, message: UpdateSettingsMessage) => {
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
      if (
        typeof message.mapWidth === "number" &&
        Number.isInteger(message.mapWidth) &&
        message.mapWidth >= MIN_MAP_DIM &&
        message.mapWidth <= MAX_MAP_DIM
      ) {
        this.state.mapWidth = message.mapWidth;
      }
      if (
        typeof message.mapHeight === "number" &&
        Number.isInteger(message.mapHeight) &&
        message.mapHeight >= MIN_MAP_DIM &&
        message.mapHeight <= MAX_MAP_DIM
      ) {
        this.state.mapHeight = message.mapHeight;
      }
      if (typeof message.seed === "number" && Number.isInteger(message.seed)) {
        this.state.seed = message.seed;
      }
      if (
        typeof message.mountainRate === "number" &&
        message.mountainRate >= 0 &&
        message.mountainRate <= 1
      ) {
        this.state.mountainRate = message.mountainRate;
      }
      if (
        typeof message.cityRate === "number" &&
        message.cityRate >= 0 &&
        message.cityRate <= 1 &&
        message.cityRate + this.state.mountainRate <= 1
      ) {
        this.state.cityRate = message.cityRate;
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

    pickColor: (client: Client, message: { color: number }) => {
      const auth = client.auth as ClientAuth;
      const player = this.state.players.find((p) => p.id === auth.id);
      if (!player) return;

      if (!isPaletteColor(message.color)) {
        client.send("error", "invalid color");
        return;
      }

      const taken = this.state.players.find(
        (p) => p.id !== auth.id && p.color === message.color,
      );
      if (taken) {
        client.send("error", "color already taken");
        return;
      }

      player.color = message.color;
    },
  };

  private isHost(client: Client): boolean {
    return (client.auth as ClientAuth)?.id === this.hostId;
  }

  private getGridOptions(): GridGeneratorOptions {
    return {
      width: this.state.mapWidth,
      height: this.state.mapHeight,
      seed: this.state.seed,
      mountainRate: this.state.mountainRate,
      cityRate: this.state.cityRate,
      generalCount: this.state.players.length,
      minGeneralDistanceFactor: this.state.minGeneralDistanceFactor,
      generalInitialTroops: this.state.generalInitialTroops,
      cityInitialTroops: this.state.cityInitialTroops,
    };
  }

  private async startGame() {
    const playerInit = this.state.players.map((p, i) => ({
      id: p.id,
      username: p.username,
      teamId: `team_${i}`,
      color: p.color,
    }));

    const game = createGame({
      mode: this.state.gameMode,
      gridOptions: this.getGridOptions(),
      playerIds: playerInit.map((p) => p.id),
    });

    const metadata: RoomData = {
      mode: this.state.gameMode,
      game,
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
