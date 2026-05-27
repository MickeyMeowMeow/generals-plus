import { JWT } from "@colyseus/auth";
import type { Client } from "@colyseus/core";
import { logger, matchMaker, Room } from "@colyseus/core";
import type { GridGeneratorInput } from "@generals-plus/engine";
import {
  DefaultGenOptions,
  DefaultGridBounds,
  GameMode,
  GridType,
  getDefaultPlayersPerTeam,
} from "@generals-plus/engine";
import type {
  ClientAuth,
  RoomData,
  SetupSettings,
  SetupValidationFailedMessage,
} from "@generals-plus/shared-types";
import {
  isPaletteColor,
  nextAvailableColor,
  ROOM_NAMES,
  SetupClientMessage,
  SetupPlayer,
  SetupServerMessage,
  SetupState,
} from "@generals-plus/shared-types";

import type { CreateGameOptions } from "#/features/game/utils";
import { createGame, generateSeed } from "#/features/game/utils";
import {
  BASE_TICK_INTERVAL,
  calculateFinishTick,
  MODE_SETTINGS,
} from "#/features/match/utils";
import { createPlayerInit } from "#/features/player/utils";
import {
  markCustomRoomMatchStarted,
  onSetupRoomDisposed,
} from "#/features/setup/custom-room-registry";
import { setupSettingsUpdateSchema } from "#/features/setup/schemas";

const DEFAULT_MAX_PLAYERS = 8;

const SETTING_LABELS: Record<string, string> = {
  gameMode: "Game Mode",
  isPublic: "Visibility",
  maxPlayers: "Max players",
  playersPerTeam: "Players per team",
  mapType: "Grid type",
  mapWidth: "Map width",
  mapHeight: "Map height",
  mapLeft: "Map left width",
  mapRight: "Map right width",
  mapLeftSlant: "Map left slant",
  mapRightSlant: "Map right slant",
  seed: "Map seed",
  mountainRate: "Mountain rate",
  cityRate: "City rate",
  minGeneralDistanceFactor: "Minimum general distance",
  generalInitialTroops: "General troops",
  cityInitialTroops: "City troops",
  speed: "Speed",
  duration: "Duration",
  flagCount: "Flag count",
  targetScore: "Target score",
};

type SetupSettingsIssue = {
  code: string;
  path: PropertyKey[];
  message: string;
  expected?: unknown;
  minimum?: unknown;
  maximum?: unknown;
};

interface SetupRoomOptions {
  gameMode?: GameMode;
  maxPlayers?: number;
  isPublic?: boolean;
}

function calculateTickInterval(speed: number): number {
  return Math.max(100, Math.round(BASE_TICK_INTERVAL / speed));
}

export class SetupRoom extends Room<{ state: SetupState }> {
  private hostId = "";
  private customRoomKey: string | null = null;

  async onCreate(options: SetupRoomOptions & { customRoomKey?: string }) {
    const gameMode = options.gameMode ?? GameMode.CLASSIC;
    const maxPlayers = options.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    const isPublic = options.isPublic ?? true;
    this.customRoomKey = options.customRoomKey ?? null;

    this.maxClients = maxPlayers;

    const state = new SetupState();
    state.gameMode = gameMode;
    state.isPublic = isPublic;
    state.maxPlayers = maxPlayers;
    state.playersPerTeam = getDefaultPlayersPerTeam(gameMode);
    state.mapType = GridType.SQUARE;
    state.mapWidth = DefaultGridBounds[GridType.SQUARE].width;
    state.mapHeight = DefaultGridBounds[GridType.SQUARE].height;
    state.mapLeft = DefaultGridBounds[GridType.HEX].left;
    state.mapRight = DefaultGridBounds[GridType.HEX].right;
    state.mapLeftSlant = DefaultGridBounds[GridType.HEX].leftSlant;
    state.mapRightSlant = DefaultGridBounds[GridType.HEX].rightSlant;
    state.seed = generateSeed();
    state.mountainRate = DefaultGenOptions.mountainRate;
    state.cityRate = DefaultGenOptions.cityRate;
    state.tickInterval = calculateTickInterval(state.speed);

    // Initialize mode-specific defaults so startGame sees the right values
    // even if the host never opens the settings panel.
    const modeDefaults = MODE_SETTINGS[gameMode];
    if (modeDefaults?.duration !== undefined) {
      state.duration = modeDefaults.duration;
      state.finishTick = calculateFinishTick(
        modeDefaults.duration,
        state.tickInterval,
      );
    }
    if (modeDefaults?.flagCount !== undefined) {
      state.flagCount = modeDefaults.flagCount;
    }
    if (modeDefaults?.targetScore !== undefined) {
      state.targetScore = modeDefaults.targetScore;
    }
    if (modeDefaults?.bombSiteCount !== undefined) {
      state.bombSiteCount = modeDefaults.bombSiteCount;
    }
    if (modeDefaults?.plantDuration !== undefined) {
      state.plantDuration = modeDefaults.plantDuration;
    }
    if (modeDefaults?.defuseDuration !== undefined) {
      state.defuseDuration = modeDefaults.defuseDuration;
    }
    if (modeDefaults?.detonateDuration !== undefined) {
      state.detonateDuration = modeDefaults.detonateDuration;
    }

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

  async onLeave(client: Client) {
    const auth = client.auth as ClientAuth;
    const id = auth.id;
    const isHost = id === this.hostId;

    this.removePlayerFromState(id);

    if (this.state.players.length === 0) {
      await this.disconnect();
      return;
    }

    if (isHost) {
      this.transferHost();
    }
  }

  onDispose() {
    if (this.customRoomKey) {
      onSetupRoomDisposed(this.customRoomKey, this.roomId);
    }
  }

  messages = {
    [SetupClientMessage.UPDATE_SETTINGS]: async (
      client: Client,
      message: Partial<SetupSettings>,
    ) => {
      if (!this.isHost(client)) {
        client.send(
          SetupServerMessage.ERROR,
          "only the host can update settings",
        );
        return;
      }

      const result = setupSettingsUpdateSchema.safeParse(message);
      if (!result.success) {
        this.sendValidationFailed(
          client,
          this.formatSettingsValidationError(result.error.issues[0]),
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
          this.sendValidationFailed(client, {
            severity: "warning",
            message: "Players per team must be less than max players.",
          });
          return;
        }
        if (activeMaxPlayers < this.state.players.length) {
          this.sendValidationFailed(client, {
            severity: "warning",
            message:
              "Max players cannot be lower than the players already here.",
          });
          return;
        }
      }

      // city + mountain rates must be <= 1.0
      if (update.cityRate !== undefined || update.mountainRate !== undefined) {
        const activeCityRate = update.cityRate ?? this.state.cityRate;
        const activeMountainRate =
          update.mountainRate ?? this.state.mountainRate;
        if (activeCityRate + activeMountainRate > 1) {
          this.sendValidationFailed(client, {
            severity: "warning",
            message: "Mountain rate and city rate must add up to 1.0 or less.",
          });
          return;
        }
      }

      // flagCount and targetScore are only allowed for domination mode
      const activeMode = update.gameMode ?? this.state.gameMode;
      if (
        update.flagCount !== undefined &&
        activeMode !== GameMode.DOMINATION
      ) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: "flagCount",
          message: "Flag count is only available in Domination mode.",
        });
        return;
      }
      if (
        update.targetScore !== undefined &&
        activeMode !== GameMode.DOMINATION
      ) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: "targetScore",
          message: "Target score is only available in Domination mode.",
        });
        return;
      }

      if (
        (update.bombSiteCount !== undefined ||
          update.plantDuration !== undefined ||
          update.defuseDuration !== undefined ||
          update.detonateDuration !== undefined) &&
        activeMode !== GameMode.DEMOLITION
      ) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: "bombSiteCount",
          message: "Demolition fields are only available in Demolition mode.",
        });
        return;
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
        if (
          update.duration === undefined &&
          modeDefaults?.duration !== undefined
        ) {
          this.state.duration = modeDefaults.duration;
        }
        if (
          update.flagCount === undefined &&
          modeDefaults?.flagCount !== undefined
        ) {
          this.state.flagCount = modeDefaults.flagCount;
        }
        if (
          update.targetScore === undefined &&
          modeDefaults?.targetScore !== undefined
        ) {
          this.state.targetScore = modeDefaults.targetScore;
        }
        if (
          update.bombSiteCount === undefined &&
          modeDefaults?.bombSiteCount !== undefined
        ) {
          this.state.bombSiteCount = modeDefaults.bombSiteCount;
        }
        if (
          update.plantDuration === undefined &&
          modeDefaults?.plantDuration !== undefined
        ) {
          this.state.plantDuration = modeDefaults.plantDuration;
        }
        if (
          update.defuseDuration === undefined &&
          modeDefaults?.defuseDuration !== undefined
        ) {
          this.state.defuseDuration = modeDefaults.defuseDuration;
        }
        if (
          update.detonateDuration === undefined &&
          modeDefaults?.detonateDuration !== undefined
        ) {
          this.state.detonateDuration = modeDefaults.detonateDuration;
        }
      }

      // Apply valid updates to state
      Object.assign(this.state, update);

      // Recompute derived values from multipliers.
      this.state.tickInterval = calculateTickInterval(this.state.speed);
      if (
        this.state.gameMode === GameMode.TURF_WAR ||
        this.state.gameMode === GameMode.DOMINATION ||
        this.state.gameMode === GameMode.DEMOLITION
      ) {
        this.state.finishTick = calculateFinishTick(
          this.state.duration,
          this.state.tickInterval,
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

    [SetupClientMessage.START_GAME]: async (client: Client) => {
      if (!this.isHost(client)) {
        client.send(
          SetupServerMessage.ERROR,
          "only the host can start the game",
        );
        return;
      }

      if (this.state.players.length < 2) {
        this.sendValidationFailed(client, {
          severity: "warning",
          message: "Need at least 2 players to start.",
        });
        return;
      }

      if (
        Math.ceil(this.state.players.length / this.state.playersPerTeam) < 2
      ) {
        this.sendValidationFailed(client, {
          severity: "warning",
          message:
            "Players per team is too high; the room needs at least two teams to start.",
        });
        return;
      }

      try {
        await this.startGame();
      } catch (error) {
        logger.warn(
          `[SetupRoom] Could not start game for room ${this.roomId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        this.sendValidationFailed(client, {
          severity: "warning",
          message:
            "Those map settings cannot start a game. Try a larger map, fewer mountains, or a lower minimum general distance.",
        });
      }
    },

    kick: (client: Client, message: { playerId: string }) => {
      if (!this.isHost(client)) {
        client.send(SetupServerMessage.ERROR, "only the host can kick players");
        return;
      }

      const target = this.clients.find(
        (c) => (c.auth as ClientAuth).id === message.playerId,
      );
      if (target && target.sessionId !== client.sessionId) {
        target.leave(4000);
      }
    },

    [SetupClientMessage.PICK_COLOR]: (
      client: Client,
      message: { color: number },
    ) => {
      const auth = client.auth as ClientAuth;
      const player = this.state.players.find((p) => p.id === auth.id);
      if (!player) return;

      if (!isPaletteColor(message.color)) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: "color",
          message: "Choose one of the available colors.",
        });
        return;
      }

      const taken = this.state.players.find(
        (p) => p.id !== auth.id && p.color === message.color,
      );
      if (taken) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: "color",
          message: "That color is already taken.",
        });
        return;
      }

      player.color = message.color;
    },
  };

  private isHost(client: Client): boolean {
    return (client.auth as ClientAuth)?.id === this.hostId;
  }

  private sendValidationFailed(
    client: Client,
    payload: SetupValidationFailedMessage,
  ) {
    client.send(SetupServerMessage.VALIDATION_FAILED, payload);
  }

  private formatSettingsValidationError(
    issue: SetupSettingsIssue,
  ): SetupValidationFailedMessage {
    const path = issue.path[0];
    const field =
      typeof path === "string" && path in SETTING_LABELS
        ? (path as keyof SetupSettings)
        : undefined;
    const label = field ? SETTING_LABELS[field] : "Settings";

    switch (issue.code) {
      case "invalid_type":
        return {
          severity: "warning",
          field,
          message:
            typeof issue.expected === "string"
              ? `${label} must be a ${issue.expected}.`
              : `${label} has the wrong value type.`,
        };
      case "too_small":
        return {
          severity: "warning",
          field,
          message:
            issue.minimum === undefined
              ? `${label} is below the allowed minimum.`
              : `${label} must be at least ${issue.minimum}.`,
        };
      case "too_big":
        return {
          severity: "warning",
          field,
          message:
            issue.maximum === undefined
              ? `${label} is above the allowed maximum.`
              : `${label} must be at most ${issue.maximum}.`,
        };
      case "invalid_value":
        return {
          severity: "warning",
          field,
          message: `${label} is not supported.`,
        };
      case "unrecognized_keys":
        return {
          severity: "warning",
          message: "Settings include an unsupported field.",
        };
      default:
        return {
          severity: "warning",
          field,
          message: `${label}: ${issue.message}`,
        };
    }
  }

  // Build grid options from current setup state, attaching mode-specific fields.
  private getGridOptions(): GridGeneratorInput {
    const gridShape =
      this.state.mapType === GridType.SQUARE
        ? {
            gridType: this.state.mapType,
            gridBounds: {
              width: this.state.mapWidth,
              height: this.state.mapHeight,
            },
          }
        : {
            gridType: this.state.mapType,
            gridBounds: {
              left: this.state.mapLeft,
              right: this.state.mapRight,
              leftSlant: this.state.mapLeftSlant,
              rightSlant: this.state.mapRightSlant,
            },
          };

    const base: GridGeneratorInput = {
      ...gridShape,
      seed: this.state.seed,
      mountainRate: this.state.mountainRate,
      cityRate: this.state.cityRate,
      generalCount: this.state.players.length,
      minGeneralDistanceFactor: this.state.minGeneralDistanceFactor,
      generalInitialTroops: this.state.generalInitialTroops,
      cityInitialTroops: this.state.cityInitialTroops,
    };

    if (this.state.gameMode === GameMode.DOMINATION) {
      return { ...base, flagCount: this.state.flagCount };
    }

    if (this.state.gameMode === GameMode.DEMOLITION) {
      return { ...base, bombSiteCount: this.state.bombSiteCount };
    }

    return base;
  }

  private buildCreateGameOptions(): CreateGameOptions {
    const base = {
      gridOptions: this.getGridOptions(),
      playerIds: this.state.players.map((p) => p.id),
      playerPerTeam: this.state.playersPerTeam,
    };

    switch (this.state.gameMode) {
      case GameMode.CLASSIC:
        return { ...base, mode: GameMode.CLASSIC };
      case GameMode.TURF_WAR:
        return {
          ...base,
          mode: GameMode.TURF_WAR,
          finishTick: this.state.finishTick,
        };
      case GameMode.DOMINATION:
        return {
          ...base,
          mode: GameMode.DOMINATION,
          finishTick: this.state.finishTick,
          targetScore: this.state.targetScore,
        };
      case GameMode.DEMOLITION:
        return {
          ...base,
          mode: GameMode.DEMOLITION,
          finishTick: this.state.finishTick,
          plantDurationTicks: calculateFinishTick(
            this.state.plantDuration,
            BASE_TICK_INTERVAL,
          ),
          defuseDurationTicks: calculateFinishTick(
            this.state.defuseDuration,
            BASE_TICK_INTERVAL,
          ),
          detonateDurationTicks: calculateFinishTick(
            this.state.detonateDuration,
            BASE_TICK_INTERVAL,
          ),
          bombSiteCount: this.state.bombSiteCount,
          seed: this.state.seed,
        };
      default:
        return { ...base, mode: this.state.gameMode };
    }
  }

  private async startGame() {
    const options = this.buildCreateGameOptions();
    const game = createGame(options);

    const playerInit = createPlayerInit(this.state.players, game);

    const isTimedMode =
      options.mode === GameMode.TURF_WAR ||
      options.mode === GameMode.DOMINATION ||
      options.mode === GameMode.DEMOLITION;

    const metadata: RoomData = {
      mode: options.mode,
      game,
      playerInit,
      isPublic: false,
      tickInterval: this.state.tickInterval,
      finishTick: isTimedMode ? this.state.finishTick : undefined,
      targetScore:
        options.mode === GameMode.DOMINATION
          ? this.state.targetScore
          : undefined,
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
        SetupServerMessage.SEAT_RESERVATION,
        matchMaker.buildSeatReservation(room, client.sessionId),
      );
    }

    if (this.customRoomKey) {
      markCustomRoomMatchStarted(this.customRoomKey, this.roomId);
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
