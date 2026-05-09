import { JWT } from "@colyseus/auth";
import type { Client } from "@colyseus/core";
import { logger, Room } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import type {
  IBaseGame,
  MoveAction,
  MoveActionType,
} from "@generals-plus/engine";
import { ActionType, GameStatus, PlayerStatus } from "@generals-plus/engine";
import type { ClientAuth, RoomData } from "@generals-plus/shared-types";
import {
  ActionData,
  ClientActionQueue,
  ClientVision,
  MatchClientMessage,
  MatchServerMessage,
  MatchState,
} from "@generals-plus/shared-types";

import { createPlayer } from "#/features/player/utils";
import { parseRoomData } from "#/features/room-data";
import { createScoreboard, syncScoreboard } from "#/features/scoreboard/utils";

const TICK_INTERVAL = 500;

export class MatchRoom extends Room<{
  state: MatchState;
  metadata: RoomData;
}> {
  private game: IBaseGame | undefined;
  private sessionToPlayerId = new Map<string, string>();
  private playerToSessionId = new Map<string, string>();

  async onCreate(options: { metadata: unknown }) {
    const metadata = parseRoomData(options.metadata);
    if (!metadata) {
      throw new Error("[MatchRoom] Invalid room metadata");
    }

    if (!metadata.isPublic) {
      await this.setPrivate(true);
    }

    this.maxClients = metadata.playerInit.length;

    this.game = metadata.game;

    const state = new MatchState();
    state.mode = metadata.mode;
    state.width = this.game.grid.width;
    state.height = this.game.grid.height;
    state.scoreboard = createScoreboard(metadata.mode);

    for (const playerInit of metadata.playerInit) {
      const player = createPlayer(metadata.mode);
      player.id = playerInit.id;
      player.displayName = playerInit.displayName;
      player.teamId = playerInit.teamId;
      player.color = playerInit.color;
      player.status = PlayerStatus.ACTIVE;
      state.players.set(playerInit.id, player);
      state.playerColors.set(playerInit.id, playerInit.color);
    }

    this.state = state;

    this.onMessage(MatchClientMessage.ACTION, (client, action: MoveAction) => {
      console.log("Received action:", action);
      const playerId = this.sessionToPlayerId.get(client.sessionId);
      if (!playerId) return;

      const queue = this.state.clientActionQueues.get(client.sessionId);
      if (!queue) return;

      if (!action.from || !action.to) return;

      const entry = new ActionData();
      entry.type = action.type;
      entry.fromX = action.from.x;
      entry.fromY = action.from.y;
      entry.toX = action.to.x;
      entry.toY = action.to.y;
      queue.queue.push(entry);
    });

    this.onMessage(MatchClientMessage.CLEAR_QUEUE, (client) => {
      const queue = this.state.clientActionQueues.get(client.sessionId);
      if (queue) {
        queue.queue.clear();
      }
    });

    this.game.startGame();
    this.state.status = GameStatus.PLAYING;

    this.setSimulationInterval(
      (deltaTime) => this.onTick(deltaTime),
      TICK_INTERVAL,
    );

    logger.info(
      `[MatchRoom] Room created: ${this.roomId}, mode: ${state.mode}, map: ${state.width}x${state.height}, players: ${metadata.playerInit.length}`,
    );
  }

  static async onAuth(token: string, _options: unknown, _context: unknown) {
    return JWT.verify(token);
  }

  onJoin(client: Client, _options: unknown) {
    client.view = new StateView();

    const userdata = client.auth as ClientAuth | undefined;

    if (userdata) {
      const player = this.state.players.get(userdata.id);
      if (player) {
        // Deduplicate: clean up old session if this player already has one.
        const oldSessionId = this.playerToSessionId.get(userdata.id);
        if (oldSessionId && oldSessionId !== client.sessionId) {
          logger.info(
            `[MatchRoom] Duplicate connection for ${userdata.displayName}, replacing session ${oldSessionId} with ${client.sessionId}`,
          );

          this.sessionToPlayerId.delete(oldSessionId);
          this.state.clientVisions.delete(oldSessionId);
          this.state.clientActionQueues.delete(oldSessionId);

          const oldClient = this.clients.find(
            (c) => c.sessionId === oldSessionId,
          );
          if (oldClient) {
            oldClient.leave(4000);
          }
        }

        player.sessionId = client.sessionId;
        player.status = PlayerStatus.ACTIVE;

        this.sessionToPlayerId.set(client.sessionId, userdata.id);
        this.playerToSessionId.set(userdata.id, client.sessionId);

        client.view.add(player);

        const vision = new ClientVision();
        this.state.clientVisions.set(client.sessionId, vision);
        client.view.add(vision);

        const actionQueue = new ClientActionQueue();
        this.state.clientActionQueues.set(client.sessionId, actionQueue);
        client.view.add(actionQueue);

        logger.info(
          `[MatchRoom] Player ${userdata.displayName} joined (session ${client.sessionId})`,
        );
      } else {
        logger.error(
          `[MatchRoom] Error: Player data not found for user: ${userdata.displayName}`,
        );
        throw new Error("Player not part of this match");
      }
    } else {
      logger.error(
        `[MatchRoom] Error: No auth data for client: ${client.sessionId}`,
      );
      throw new Error("No auth data");
    }
  }

  onLeave(client: Client, _code?: number) {
    if (!this.game) {
      logger.error(`[MatchRoom] Error: Game instance not found on leave`);
      throw new Error("Game instance not found");
    }
    const playerId = this.sessionToPlayerId.get(client.sessionId);
    if (playerId) {
      const player = this.state.players.get(playerId);
      if (player && player.status === PlayerStatus.ACTIVE) {
        this.game.handleAction({ playerId, type: ActionType.SURRENDER });
      }

      this.sessionToPlayerId.delete(client.sessionId);
      this.playerToSessionId.delete(playerId);
    }
    this.state.clientVisions.delete(client.sessionId);
    this.state.clientActionQueues.delete(client.sessionId);
    logger.info(`[MatchRoom] ${client.sessionId} left`);
  }

  onDispose() {
    this.sessionToPlayerId.clear();
    this.playerToSessionId.clear();
    logger.info("[MatchRoom] Room disposed");
  }

  private onTick(_deltaTime: number) {
    if (!this.game) {
      logger.error(`[MatchRoom] Error: Game instance not found on tick`);
      throw new Error("Game instance not found");
    }
    this.processActionQueues();

    this.game.nextTick();
    this.state.tick = this.game.tick;

    this.syncPlayerState();
    this.syncScoreboard();
    this.updateClientViews();

    const result = this.game.checkGameEnd();
    if (result) {
      this.state.status = GameStatus.FINISHED;
      this.broadcast(MatchServerMessage.GAME_END, result);
      this.disconnect();
    }
  }

  private processActionQueues() {
    if (!this.game) {
      logger.error(
        `[MatchRoom] Error: Game instance not found on processActionQueues`,
      );
      throw new Error("Game instance not found");
    }
    for (const [sessionId, schemaQueue] of this.state.clientActionQueues) {
      const playerId = this.sessionToPlayerId.get(sessionId);
      if (!playerId) continue;

      while (schemaQueue.queue.length > 0) {
        const entry = schemaQueue.queue.shift();
        if (!entry) break;

        if (entry.type === ActionType.CLEAR_QUEUE) {
          schemaQueue.queue.clear();
          break;
        }

        const action: MoveAction = {
          playerId,
          type: entry.type as MoveActionType,
          from: { x: entry.fromX, y: entry.fromY },
          to: { x: entry.toX, y: entry.toY },
        };
        console.log("Processing action:", action);
        console.log(this.game.grid.get({ x: entry.fromX, y: entry.fromY }));

        const executed = this.game.handleAction(action);
        if (executed) {
          break;
        }
      }
    }
  }

  private syncPlayerState() {
    if (!this.game) {
      logger.error(
        `[MatchRoom] Error: Game instance not found on syncPlayerState`,
      );
      throw new Error("Game instance not found");
    }
    for (const [playerId, player] of this.state.players) {
      const state = this.game.getPlayerState(playerId);
      if (!state) continue;

      player.teamId = state.teamId;

      const prevStatus = player.status;
      player.status = state.status;

      if (
        prevStatus !== PlayerStatus.ELIMINATED &&
        player.status === PlayerStatus.ELIMINATED
      ) {
        const sessionId = this.playerToSessionId.get(playerId);
        if (sessionId) {
          this.state.clientActionQueues.delete(sessionId);
        }

        logger.info(
          `[MatchRoom] Player ${player.displayName} eliminated at tick ${this.game.tick}`,
        );
      }
    }
  }

  private syncScoreboard() {
    if (!this.game) {
      logger.error(
        `[MatchRoom] Error: Game instance not found on syncScoreboard`,
      );
      throw new Error("Game instance not found");
    }

    syncScoreboard(this.state.scoreboard, this.game.getScoreboard());
  }

  private updateClientViews() {
    if (!this.game) {
      logger.error(
        `[MatchRoom] Error: Game instance not found on updateClientViews`,
      );
      throw new Error("Game instance not found");
    }
    for (const client of this.clients) {
      const playerId = this.sessionToPlayerId.get(client.sessionId);
      if (!playerId || !client.view) continue;

      const visionGrid = this.game.getVisionGrid(playerId);
      const vision = this.state.clientVisions.get(client.sessionId);
      if (!visionGrid || !vision) continue;

      vision.visibility.clear();
      vision.terrain.clear();
      vision.troopCount.clear();
      vision.ownerIndex.clear();

      const width = this.state.width;
      const height = this.state.height;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const vc = visionGrid.get({ x, y });
          if (vc) {
            vision.visibility.push(vc.visibility);
            vision.terrain.push(vc.terrain ?? "");
            vision.troopCount.push(vc.troopCount ?? -1);
            vision.ownerIndex.push(
              vc.owner?.status === PlayerStatus.ACTIVE ? vc.owner.playerId : "",
            );
          } else {
            vision.visibility.push("hidden");
            vision.terrain.push("");
            vision.troopCount.push(-1);
            vision.ownerIndex.push("");
          }
        }
      }
    }
  }
}
