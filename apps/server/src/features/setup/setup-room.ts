import { JWT } from "@colyseus/auth";
import type { Client } from "@colyseus/core";
import { logger, matchMaker, Room } from "@colyseus/core";
import type { GridGeneratorOptions } from "@generals-plus/engine";
import {
  DefaultGridGeneratorOptions,
  GameMode,
  getDefaultPlayersPerTeam,
} from "@generals-plus/engine";
import type {
  ClientAuth,
  RoomData,
  SetupSettings,
} from "@generals-plus/shared-types";
import {
  isPaletteColor,
  nextAvailableColor,
  ROOM_NAMES,
  SetupPlayer,
  SetupState,
} from "@generals-plus/shared-types";

import { createGame } from "#/features/game/utils";
import { createPlayerInit } from "#/features/player/utils";
import { setupSettingsUpdateSchema } from "./schemas";

const BASE_TICK_INTERVAL = 500;

const MODE_SETTINGS: Record<string, { finishTick?: number }> = {
  classic: {},
  turf_war: { finishTick: 360 },
};

const DEFAULT_MAX_PLAYERS = 8;

interface SetupRoomOptions {
  gameMode?: GameMode;
  maxPlayers?: number;
  isPublic?: boolean;
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
    state.playersPerTeam = getDefaultPlayersPerTeam(gameMode);
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
    const displayName = auth.displayName ?? `Player_${this.clients.length + 1}`;

    // Deduplicate: if this player_id already has a connection, kick the old one.
    const existingClient = this.clients.find(
      (c) =>
        c.sessionId !== client.sessionId && (c.auth as ClientAuth).id === id,
    );
    if (existingClient) {
      logger.info(
        `[SetupRoom] Duplicate connection for ${displayName}, kicking old session ${existingClient.sessionId}`,
      );
      existingClient.leave(4000);
    }

    const isFirst = this.state.players.length === 0;

    const player = new SetupPlayer();
    player.id = id;
    player.displayName = displayName;
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
    updateSettings: async (client: Client, message: Partial<SetupSettings>) => {
      if (!this.isHost(client)) {
        client.send("error", "only the host can update settings");
        return;
      }

      const result = setupSettingsUpdateSchema.safeParse(message);
      if (!result.success) {
        client.send(
          "error",
          `invalid settings update: ${result.error.message}`,
        );
        return;
      }

      const update = result.data;

      // playersPerTeam must be < maxPlayers
      if (
        update.maxPlayers !== undefined ||
        update.playersPerTeam !== undefined
      ) {
        const activeMaxPlayers = update.maxPlayers ?? this.state.maxPlayers;
        const activePlayersPerTeam =
          update.playersPerTeam ?? this.state.playersPerTeam;
        if (activePlayersPerTeam >= activeMaxPlayers) {
          client.send("error", "playersPerTeam must be less than maxPlayers");
          return;
        }
      }

      // city + mountain rates must be <= 1.0
      if (update.cityRate !== undefined || update.mountainRate !== undefined) {
        const activeCityRate = update.cityRate ?? this.state.cityRate;
        const activeMountainRate =
          update.mountainRate ?? this.state.mountainRate;
        if (activeCityRate + activeMountainRate > 1) {
          client.send("error", "cityRate + mountainRate cannot exceed 1.0");
          return;
        }
      }

      // When gameMode changes without an explicit playersPerTeam, reset to the
      // mode default so the host doesn't carry a stale value across modes.
      if (
        update.gameMode !== undefined &&
        update.playersPerTeam === undefined
      ) {
        update.playersPerTeam = getDefaultPlayersPerTeam(update.gameMode);
      }

      // Reset mode-specific defaults when gameMode changes.
      if (update.gameMode !== undefined) {
        const modeDefaults = MODE_SETTINGS[update.gameMode];
        if (update.duration === undefined) {
          this.state.duration = 1;
        }
        if (modeDefaults?.finishTick !== undefined) {
          this.state.finishTick = modeDefaults.finishTick;
        }
      }

      // Apply valid updates to state
      Object.assign(this.state, update);

      // Recompute derived values from multipliers.
      this.state.tickInterval = Math.round(
        BASE_TICK_INTERVAL / this.state.speed,
      );
      if (this.state.gameMode === "turf_war") {
        const baseFinishTick = MODE_SETTINGS.turf_war.finishTick ?? 360;
        this.state.finishTick = Math.round(
          baseFinishTick * this.state.duration,
        );
      }

      // Synchronize room-level properties and visibility
      if (update.maxPlayers !== undefined) {
        this.maxClients = update.maxPlayers;
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
      if (target && target.sessionId !== client.sessionId) {
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
    const game = createGame({
      mode: this.state.gameMode,
      gridOptions: this.getGridOptions(),
      playerIds: this.state.players.map((p) => p.id),
      playerPerTeam: this.state.playersPerTeam,
      finishTick:
        this.state.gameMode === "turf_war" ? this.state.finishTick : undefined,
    });

    const playerInit = createPlayerInit(this.state.players, game);

    const metadata: RoomData = {
      mode: this.state.gameMode,
      game,
      playerInit,
      isPublic: false,
      tickInterval: this.state.tickInterval,
      finishTick:
        this.state.gameMode === "turf_war" ? this.state.finishTick : undefined,
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
