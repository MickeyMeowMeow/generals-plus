import { JWT } from "@colyseus/auth";
import type { Client } from "@colyseus/core";
import { logger, matchMaker, Room } from "@colyseus/core";
import type { CollapseShape, GridGeneratorInput } from "@generals-plus/engine";
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
const SETUP_TEAM_PREFIX = "setup_team_";
const DEMOLITION_FINAL_TEAM_IDS = ["attackers", "defenders"] as const;
const DEMOLITION_SETUP_TEAM_IDS = ["attackers", "defenders"] as const;

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
  payloadSpeed: "Cart speed",
  payloadCartSize: "Cart size",
  payloadRequiredOccupied: "Required occupied tiles",
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

function getDemolitionPlayersPerTeam(maxPlayers: number) {
  return Math.ceil(maxPlayers / 2);
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
    state.playersPerTeam =
      gameMode === GameMode.DEMOLITION
        ? getDemolitionPlayersPerTeam(maxPlayers)
        : getDefaultPlayersPerTeam(gameMode);
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
    if (modeDefaults) {
      Object.assign(state, modeDefaults);
      if (modeDefaults.duration !== undefined) {
        state.finishTick = calculateFinishTick(
          modeDefaults.duration,
          state.tickInterval,
        );
      }
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
    player.teamId = this.assignNextSetupTeamId();
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

      // When gameMode changes without an explicit playersPerTeam, reset to the
      // mode default so the host doesn't carry a stale value across modes.
      if (
        update.gameMode !== undefined &&
        update.playersPerTeam === undefined
      ) {
        update.playersPerTeam =
          update.gameMode === GameMode.DEMOLITION
            ? Math.max(
                this.state.playersPerTeam,
                getDemolitionPlayersPerTeam(
                  update.maxPlayers ?? this.state.maxPlayers,
                ),
              )
            : getDefaultPlayersPerTeam(update.gameMode);
      } else if (
        (update.gameMode === GameMode.DEMOLITION ||
          (update.gameMode === undefined &&
            this.state.gameMode === GameMode.DEMOLITION)) &&
        update.maxPlayers !== undefined &&
        update.playersPerTeam === undefined
      ) {
        update.playersPerTeam = Math.max(
          this.state.playersPerTeam,
          getDemolitionPlayersPerTeam(update.maxPlayers),
        );
      }

      // playersPerTeam must be < maxPlayers for standard modes, and large
      // enough to fit two fixed teams in Demolition.
      if (
        update.maxPlayers !== undefined ||
        update.playersPerTeam !== undefined
      ) {
        const activeMaxPlayers = update.maxPlayers ?? this.state.maxPlayers;
        const activePlayersPerTeam =
          update.playersPerTeam ?? this.state.playersPerTeam;
        const activeMode = update.gameMode ?? this.state.gameMode;
        if (
          activeMode !== GameMode.DEMOLITION &&
          activePlayersPerTeam >= activeMaxPlayers
        ) {
          this.sendValidationFailed(client, {
            severity: "warning",
            message: "Players per team must be less than max players.",
          });
          return;
        }
        if (
          activeMode === GameMode.DEMOLITION &&
          activePlayersPerTeam < getDemolitionPlayersPerTeam(activeMaxPlayers)
        ) {
          this.sendValidationFailed(client, {
            severity: "warning",
            message:
              "Players per team must be at least half of max players in Demolition.",
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

      const DEMOLITION_FIELDS = [
        "bombSiteCount",
        "plantDuration",
        "defuseDuration",
        "detonateDuration",
      ] as const;
      const invalidDemoField = DEMOLITION_FIELDS.find(
        (f) => update[f] !== undefined,
      );
      if (
        invalidDemoField !== undefined &&
        activeMode !== GameMode.DEMOLITION
      ) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: invalidDemoField,
          message: "Demolition fields are only available in Demolition mode.",
        });
        return;
      }

      const COLLAPSE_FIELDS = [
        "collapseInterval",
        "startDelay",
        "collapseShape",
      ] as const;
      const invalidCollapseField = COLLAPSE_FIELDS.find(
        (f) => update[f] !== undefined,
      );
      if (
        invalidCollapseField !== undefined &&
        activeMode !== GameMode.COLLAPSE
      ) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: invalidCollapseField,
          message: "Collapse fields are only available in Collapse mode.",
        });
        return;
      }

      const PAYLOAD_FIELDS = [
        "payloadSpeed",
        "payloadCartSize",
        "payloadRequiredOccupied",
      ] as const;
      const invalidPayloadField = PAYLOAD_FIELDS.find(
        (f) => update[f] !== undefined,
      );
      if (
        invalidPayloadField !== undefined &&
        activeMode !== GameMode.PAYLOAD
      ) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: invalidPayloadField,
          message: "Payload fields are only available in Payload mode.",
        });
        return;
      }

      // Reset mode-specific defaults when gameMode changes.
      if (update.gameMode !== undefined) {
        const modeDefaults = MODE_SETTINGS[update.gameMode];
        if (modeDefaults) {
          const defaultsToApply: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(modeDefaults)) {
            if (value !== undefined && !(key in update)) {
              defaultsToApply[key] = value;
            }
          }
          Object.assign(this.state, defaultsToApply);
        }
      }

      const shouldRebuildFromSoloToTeams =
        this.state.gameMode !== GameMode.DEMOLITION &&
        (update.gameMode ?? this.state.gameMode) !== GameMode.DEMOLITION &&
        this.state.playersPerTeam === 1 &&
        (update.playersPerTeam ?? this.state.playersPerTeam) > 1;

      // Apply valid updates to state
      Object.assign(this.state, update);

      // Recompute derived values from multipliers.
      this.state.tickInterval = calculateTickInterval(this.state.speed);
      if (
        this.state.gameMode === GameMode.TURF_WAR ||
        this.state.gameMode === GameMode.DOMINATION ||
        this.state.gameMode === GameMode.DEMOLITION ||
        this.state.gameMode === GameMode.PAYLOAD
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

      this.normalizePlayerTeams({
        redistribute:
          update.gameMode !== undefined ||
          update.maxPlayers !== undefined ||
          update.playersPerTeam !== undefined,
        forceRebuild: shouldRebuildFromSoloToTeams,
      });

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

      if (this.getOccupiedTeamIds().length < 2) {
        this.sendValidationFailed(client, {
          severity: "warning",
          message: "The room needs players on at least two teams to start.",
        });
        return;
      }

      if (this.hasOversizedTeams()) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: "team",
          message: "Move players until every team is within the limit.",
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

    [SetupClientMessage.PICK_TEAM]: (
      client: Client,
      message: { teamId?: string; createNew?: boolean },
    ) => {
      const auth = client.auth as ClientAuth;
      const player = this.state.players.find((p) => p.id === auth.id);
      if (!player) return;

      if (message.createNew) {
        if (this.state.gameMode === GameMode.DEMOLITION) {
          this.sendValidationFailed(client, {
            severity: "warning",
            field: "team",
            message: "Demolition teams are fixed to Attackers and Defenders.",
          });
          return;
        }

        const teamId = this.createSetupTeamForPlayer(player);
        if (!teamId) {
          this.sendValidationFailed(client, {
            severity: "warning",
            field: "team",
            message: "A new team is not available right now.",
          });
          return;
        }

        player.teamId = teamId;
        return;
      }

      if (
        typeof message.teamId !== "string" ||
        !this.isValidTeamId(message.teamId)
      ) {
        this.sendValidationFailed(client, {
          severity: "warning",
          field: "team",
          message: "Choose one of the available teams.",
        });
        return;
      }

      player.teamId = message.teamId;
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

    if (this.state.gameMode === GameMode.PAYLOAD) {
      return {
        ...base,
        isPayload: true,
        payloadCartSize: this.state.payloadCartSize,
      };
    }

    return base;
  }

  private buildCreateGameOptions(): CreateGameOptions {
    const teamAssignments = this.buildFinalTeamAssignments();
    const base = {
      gridOptions: this.getGridOptions(),
      playerIds: this.state.players.map((p) => p.id),
      playerPerTeam: this.state.playersPerTeam,
      teamAssignments,
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
            this.state.tickInterval,
          ),
          defuseDurationTicks: calculateFinishTick(
            this.state.defuseDuration,
            this.state.tickInterval,
          ),
          detonateDurationTicks: calculateFinishTick(
            this.state.detonateDuration,
            this.state.tickInterval,
          ),
          bombSiteCount: this.state.bombSiteCount,
          seed: this.state.seed,
        };
      case GameMode.COLLAPSE:
        return {
          ...base,
          mode: GameMode.COLLAPSE,
          startDelayTicks: calculateFinishTick(
            this.state.startDelay,
            this.state.tickInterval,
          ),
          shrinkIntervalTicks: calculateFinishTick(
            this.state.collapseInterval,
            this.state.tickInterval,
          ),
          collapseShape: this.state.collapseShape as CollapseShape,
        };
      case GameMode.PAYLOAD:
        return {
          ...base,
          mode: GameMode.PAYLOAD,
          finishTick: this.state.finishTick,
          payloadSpeed: this.state.payloadSpeed,
          payloadCartSize: this.state.payloadCartSize,
          payloadRequiredOccupied: this.state.payloadRequiredOccupied,
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
      options.mode === GameMode.DEMOLITION ||
      options.mode === GameMode.PAYLOAD;

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

  private getTeamCapacity(): number {
    return Math.max(1, this.state.playersPerTeam);
  }

  private isValidTeamId(teamId: string): boolean {
    if (this.state.gameMode === GameMode.DEMOLITION) {
      return DEMOLITION_SETUP_TEAM_IDS.includes(
        teamId as (typeof DEMOLITION_SETUP_TEAM_IDS)[number],
      );
    }

    return this.state.players.some((player) => player.teamId === teamId);
  }

  private countPlayersOnTeam(teamId: string): number {
    return this.state.players.filter((player) => player.teamId === teamId)
      .length;
  }

  private pickRandomTeamId(teamIds: string[]): string | undefined {
    if (teamIds.length === 0) return undefined;
    return teamIds[Math.floor(Math.random() * teamIds.length)];
  }

  private normalizePlayerTeams({
    redistribute = false,
    forceRebuild = false,
  }: {
    redistribute?: boolean;
    forceRebuild?: boolean;
  } = {}) {
    if (!redistribute) return;

    if (!forceRebuild && this.isCurrentTeamLayoutValid()) {
      return;
    }

    const counts = new Map<string, number>();
    for (const player of this.state.players) {
      player.teamId = this.assignNextSetupTeamId(counts);
    }
  }

  private getOccupiedTeamIds(): string[] {
    const occupiedTeamIds: string[] = [];
    const seen = new Set<string>();

    for (const player of this.state.players) {
      if (!player.teamId || seen.has(player.teamId)) continue;
      seen.add(player.teamId);
      occupiedTeamIds.push(player.teamId);
    }

    return occupiedTeamIds;
  }

  private getMaxSetupGroupCount(): number | null {
    if (this.state.gameMode === GameMode.DEMOLITION) {
      return DEMOLITION_FINAL_TEAM_IDS.length;
    }

    return null;
  }

  private assignNextSetupTeamId(counts = this.getCurrentTeamCounts()): string {
    if (this.state.gameMode === GameMode.DEMOLITION) {
      return this.assignDemolitionSetupTeamId(counts);
    }

    const teamCapacity = this.getTeamCapacity();
    const nonEmptyTeamIds = Array.from(counts.entries())
      .filter(([, count]) => count > 0 && count < teamCapacity)
      .map(([teamId]) => teamId);

    if (nonEmptyTeamIds.length > 0) {
      const minCount = Math.min(
        ...nonEmptyTeamIds.map((teamId) => counts.get(teamId) ?? 0),
      );
      const candidateTeamIds = nonEmptyTeamIds.filter(
        (teamId) => (counts.get(teamId) ?? 0) === minCount,
      );
      const chosenTeamId =
        this.pickRandomTeamId(candidateTeamIds) ?? candidateTeamIds[0];
      counts.set(chosenTeamId, (counts.get(chosenTeamId) ?? 0) + 1);
      return chosenTeamId;
    }

    const teamId = this.createSetupTeamId(counts.keys());
    counts.set(teamId, 1);
    return teamId;
  }

  private assignDemolitionSetupTeamId(
    counts = this.getCurrentTeamCounts(),
  ): string {
    const teamCapacity = this.getTeamCapacity();
    const availableTeamIds = DEMOLITION_SETUP_TEAM_IDS.filter(
      (teamId) => (counts.get(teamId) ?? 0) < teamCapacity,
    );
    const candidatePool =
      availableTeamIds.length > 0
        ? availableTeamIds
        : [...DEMOLITION_SETUP_TEAM_IDS];
    const minCount = Math.min(
      ...candidatePool.map((teamId) => counts.get(teamId) ?? 0),
    );
    const candidateTeamIds = candidatePool.filter(
      (teamId) => (counts.get(teamId) ?? 0) === minCount,
    );
    const chosenTeamId =
      this.pickRandomTeamId(candidateTeamIds) ?? candidateTeamIds[0];
    counts.set(chosenTeamId, (counts.get(chosenTeamId) ?? 0) + 1);
    return chosenTeamId;
  }

  private getCurrentTeamCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const player of this.state.players) {
      if (!player.teamId) continue;
      counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
    }
    return counts;
  }

  private createSetupTeamId(
    takenIds: Iterable<string> = this.getOccupiedTeamIds(),
  ): string {
    const indices = Array.from(takenIds)
      .map((teamId) => {
        const match = new RegExp(`^${SETUP_TEAM_PREFIX}(\\d+)$`).exec(teamId);
        return match ? Number(match[1]) : -1;
      })
      .filter((index) => index >= 0);

    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 0;
    return `${SETUP_TEAM_PREFIX}${nextIndex}`;
  }

  private createSetupTeamForPlayer(player: SetupPlayer): string | null {
    const occupiedTeamIds = this.getOccupiedTeamIds();
    const currentTeamCount = this.countPlayersOnTeam(player.teamId);
    const occupiedWithoutCurrent =
      player.teamId && currentTeamCount === 1
        ? occupiedTeamIds.filter((teamId) => teamId !== player.teamId)
        : occupiedTeamIds;
    const maxGroupCount = this.getMaxSetupGroupCount();

    if (
      maxGroupCount !== null &&
      occupiedWithoutCurrent.length >= maxGroupCount
    ) {
      return null;
    }

    return this.createSetupTeamId(occupiedTeamIds);
  }

  private buildFinalTeamAssignments(): Record<string, string> {
    const occupiedTeamIds = this.getOccupiedTeamIds();

    if (this.state.gameMode === GameMode.DEMOLITION) {
      return Object.fromEntries(
        this.state.players.map((player) => {
          if (
            DEMOLITION_FINAL_TEAM_IDS.includes(
              player.teamId as (typeof DEMOLITION_FINAL_TEAM_IDS)[number],
            )
          ) {
            return [player.id, player.teamId];
          }

          const groupIndex = Math.max(
            0,
            occupiedTeamIds.indexOf(player.teamId),
          );
          return [
            player.id,
            DEMOLITION_FINAL_TEAM_IDS[groupIndex] ?? "defenders",
          ];
        }),
      );
    }

    return Object.fromEntries(
      this.state.players.map((player) => {
        const groupIndex = Math.max(0, occupiedTeamIds.indexOf(player.teamId));
        return [player.id, `team_${groupIndex}`];
      }),
    );
  }

  private hasOversizedTeams(): boolean {
    const teamCapacity = this.getTeamCapacity();

    return this.getOccupiedTeamIds().some(
      (teamId) => this.countPlayersOnTeam(teamId) > teamCapacity,
    );
  }

  private isCurrentTeamLayoutValid(): boolean {
    const teamCapacity = this.getTeamCapacity();
    const teamCounts = this.getCurrentTeamCounts();

    if (this.state.gameMode === GameMode.DEMOLITION) {
      for (const player of this.state.players) {
        if (
          !DEMOLITION_SETUP_TEAM_IDS.includes(
            player.teamId as (typeof DEMOLITION_SETUP_TEAM_IDS)[number],
          )
        ) {
          return false;
        }
      }

      return DEMOLITION_SETUP_TEAM_IDS.every(
        (teamId) => (teamCounts.get(teamId) ?? 0) <= teamCapacity,
      );
    }

    for (const player of this.state.players) {
      if (!player.teamId) {
        return false;
      }
    }

    return Array.from(teamCounts.values()).every(
      (count) => count <= teamCapacity,
    );
  }
}
