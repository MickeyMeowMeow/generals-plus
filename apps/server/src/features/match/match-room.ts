import type { Client } from "@colyseus/core";
import { logger, Room } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import type { GridInfo, ScoreboardEntry } from "@generals-plus/ai";
import { BotBridge, BotSession } from "@generals-plus/ai";
import type {
  Action,
  IBaseGame,
  IGameResult,
  IVisionCell,
  MoveAction,
  MoveActionType,
  RugbyGame,
} from "@generals-plus/engine";
import {
  ActionType,
  GameMode,
  GameStatus,
  GridType,
  ItemType,
  PlayerStatus,
  Terrain,
} from "@generals-plus/engine";
import type { ClientAuth, RoomData } from "@generals-plus/shared-types";
import {
  ActionData,
  ClientActionQueue,
  ClientVision,
  MatchClientMessage,
  MatchServerMessage,
  MatchState,
  PublicPlayer,
  VisionCellSchema,
} from "@generals-plus/shared-types";
import * as z from "zod";

import { ENV } from "#/env";
import { resolveAuthUser } from "#/features/auth/auth-config";
import { createPlayer } from "#/features/player/utils";
import { calculateNewRatings } from "#/features/rating/rating-service";
import { parseRoomData } from "#/features/room-data";
import { createScoreboard, syncScoreboard } from "#/features/scoreboard/utils";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

const TICK_INTERVAL = 500;
const userRepository = new MongoUserRepository();

export class MatchRoom extends Room<{
  state: MatchState;
  metadata: RoomData;
}> {
  private game: IBaseGame | undefined;
  private isRatedMatch = true;
  private sessionToPlayerId = new Map<string, string>();
  private playerToSessionId = new Map<string, string>();
  private botBridge: BotBridge | null = null;
  private botSessions: BotSession[] = [];

  async onCreate(options: { metadata: unknown }) {
    const metadata = parseRoomData(options.metadata);
    if (!metadata) {
      throw new Error("[MatchRoom] Invalid room metadata");
    }

    await this.setMetadata(metadata);

    if (!metadata.isPublic) {
      await this.setPrivate(true);
    }
    this.isRatedMatch = metadata.isPublic !== false;

    // Count human players for maxClients (bots don't need real connections)
    const humanPlayers = metadata.playerInit.filter((p) => !p.isBot);
    this.maxClients = humanPlayers.length;

    this.game = metadata.game;

    const tickInterval = metadata.tickInterval ?? TICK_INTERVAL;

    const state = new MatchState();
    state.mode = metadata.mode;
    state.tickInterval = tickInterval;
    state.finishTick = metadata.finishTick ?? -1;
    state.targetScore = metadata.targetScore ?? -1;
    state.scoreboard = createScoreboard(metadata.mode);

    state.gridType = this.game.grid.gridType;
    if (this.game.grid.gridType === GridType.SQUARE) {
      state.width = this.game.grid.width;
      state.height = this.game.grid.height;
    }
    if (this.game.grid.gridType === GridType.HEX) {
      state.left = this.game.grid.left;
      state.right = this.game.grid.right;
      state.leftSlant = this.game.grid.leftSlant;
      state.rightSlant = this.game.grid.rightSlant;
    }

    if (metadata.mode === GameMode.PAYLOAD) {
      for (const coord of this.game.grid.track) {
        state.payloadTrackX.push(coord.x);
        state.payloadTrackY.push(coord.y);
      }
    }

    for (const playerInit of metadata.playerInit) {
      const player = createPlayer(metadata.mode);
      // Mirror the public subset separately so Colyseus views can expose
      // identities, colors, and elimination state without leaking hidden data.
      const publicPlayer = new PublicPlayer();

      player.id = playerInit.id;
      player.displayName = playerInit.displayName;
      player.teamId = playerInit.teamId;
      player.color = playerInit.color;
      player.status = PlayerStatus.ACTIVE;

      publicPlayer.id = playerInit.id;
      publicPlayer.status = PlayerStatus.ACTIVE;
      publicPlayer.teamId = playerInit.teamId;
      publicPlayer.displayName = playerInit.displayName;
      publicPlayer.color = playerInit.color;

      state.players.set(playerInit.id, player);
      state.publicPlayers.set(playerInit.id, publicPlayer);
    }

    this.state = state;

    // Initialize bot sessions for players marked as bots
    const botPlayers = metadata.playerInit.filter((p) => p.isBot);
    if (botPlayers.length > 0) {
      const bridge = new BotBridge(ENV.BOT_SERVICE_URL);
      this.botBridge = bridge;

      const gridInfo: GridInfo =
        state.gridType === GridType.SQUARE
          ? { type: "square", width: state.width, height: state.height }
          : {
              type: "hex",
              width: state.right - state.left + 1,
              height: state.rightSlant - state.leftSlant + 1,
            };

      bridge
        .connect()
        .then(() => {
          for (const botInit of botPlayers) {
            const session = new BotSession(botInit.id, bridge, gridInfo);
            session.register(
              this.state,
              this.sessionToPlayerId,
              this.playerToSessionId,
            );
            this.botSessions.push(session);
          }
          logger.info(`[MatchRoom] ${botPlayers.length} bot(s) registered`);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`[MatchRoom] Failed to connect to bot service: ${msg}`);
        });
    }

    this.onMessage(MatchClientMessage.ACTION, (client, action: Action) => {
      logger.debug(`[MatchRoom] Received action: ${JSON.stringify(action)}`);

      if (!this.game) {
        throw new Error("Game instance not found");
      }

      const playerId = this.sessionToPlayerId.get(client.sessionId);
      if (!playerId) return;

      const queue = this.state.clientActionQueues.get(client.sessionId);
      if (!queue) return;

      if (action.type === ActionType.SURRENDER) {
        queue.queue.clear();
        this.game?.handleAction({ playerId, type: ActionType.SURRENDER });
        return;
      }

      if (action.type === ActionType.CLEAR_QUEUE) {
        queue.queue.clear();
        return;
      }

      if (
        action.type !== ActionType.MOVE &&
        action.type !== ActionType.SPLIT_MOVE
      ) {
        return;
      }

      if (!action.from || !action.to) return;
      const vision = this.state.clientVisions.get(client.sessionId);
      if (vision) {
        const targetIndex = this.game.grid.toArrayIndex(action.to);
        if (targetIndex === -1) {
          return;
        }
        const perceivedTerrain = vision.cells[targetIndex].terrain;
        if (
          perceivedTerrain === Terrain.MOUNTAIN ||
          perceivedTerrain === Terrain.VOID
        ) {
          return;
        }
      }

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

    this.onMessage(MatchClientMessage.PING, (client, data) => {
      const playerId = this.sessionToPlayerId.get(client.sessionId);
      if (!playerId) return;
      const player = this.state.players.get(playerId);
      if (!player) return;

      const schema = z.object({
        x: z.number().int(),
        y: z.number().int(),
        type: z.enum(["attack", "defense", "rally"]),
      });

      const result = schema.safeParse(data);
      if (!result.success) {
        return;
      }

      const { x, y, type } = result.data;

      if (!this.game?.grid.isValid({ x, y })) {
        return;
      }

      // Broadcast to other players on the same team (including sender to confirm delivery)
      this.clients.forEach((otherClient) => {
        const otherPlayerId = this.sessionToPlayerId.get(otherClient.sessionId);
        if (!otherPlayerId) return;
        const otherPlayer = this.state.players.get(otherPlayerId);
        if (otherPlayer && otherPlayer.teamId === player.teamId) {
          otherClient.send(MatchServerMessage.PING, {
            playerId,
            x,
            y,
            type,
          });
        }
      });
    });

    this.game.startGame();
    this.state.status = GameStatus.PLAYING;

    // Immediately synchronize the starting scoreboard and player states
    // so client subscriptions receive the correct centered cartIndex right away.
    this.syncPlayerState();
    this.syncScoreboard();

    this.setSimulationInterval(
      (deltaTime) => this.onTick(deltaTime),
      tickInterval,
    );

    const mapBounds =
      this.state.gridType === GridType.SQUARE
        ? `square map: ${state.width}x${state.height}`
        : `hex map: ${state.left}x${state.right}x${state.leftSlant}x${state.rightSlant}`;
    logger.info(
      `[MatchRoom] Room created: ${this.roomId}, mode: ${state.mode}, ${mapBounds}, players: ${metadata.playerInit.length}`,
    );
  }

  static async onAuth(token: string, _options: unknown, _context: unknown) {
    return resolveAuthUser(token);
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

        this.updateClientView(client);

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
    for (const session of this.botSessions) {
      session.end();
    }
    this.botBridge?.dispose();
    this.botSessions = [];
    this.sessionToPlayerId.clear();
    this.playerToSessionId.clear();
    logger.info("[MatchRoom] Room disposed");
  }

  /**
   * Extract scoreboard entries from the synced room state.
   * All game modes share the same TroopLandScoreboardPlayerEntry base
   * with playerId, troops, land, isAlive — which is exactly what the
   * bot protocol needs.
   */
  private extractScoreboard(): ScoreboardEntry[] {
    const scoreboard = this.state.scoreboard as unknown as {
      players: Array<{
        playerId: string;
        troops: number;
        land: number;
        isAlive: boolean;
      }>;
    };
    return scoreboard.players.map((p) => ({
      playerId: p.playerId,
      troops: p.troops,
      land: p.land,
      isAlive: p.isAlive,
    }));
  }

  private async onTick(_deltaTime: number) {
    if (!this.game) {
      logger.error(`[MatchRoom] Error: Game instance not found on tick`);
      throw new Error("Game instance not found");
    }
    if (this.state.status === GameStatus.FINISHED) return;

    // Collect bot actions before processing queues
    const game = this.game;
    if (this.botSessions.length > 0) {
      const scoreboard = this.extractScoreboard();
      await Promise.all(
        this.botSessions.map((s) => s.onTick(game, this.state, scoreboard)),
      );
    }

    this.processActionQueues();

    this.game.nextTick();
    this.state.tick = this.game.tick;

    this.syncPlayerState();
    this.syncScoreboard();

    for (const client of this.clients) {
      this.updateClientView(client);
    }

    // Update bot visions for spectators
    for (const session of this.botSessions) {
      session.updateVision(this.game, this.state);
    }

    const result = this.game.checkGameEnd();
    if (result) {
      this.finishMatch(result);
      return;
    }

    // Some engine flows can flip the game status during `nextTick()` without
    // returning a fresh result payload here, so derive a minimal final result
    // from synced room state before closing the room and broadcasting it.
    if (this.game.status === GameStatus.FINISHED) {
      this.finishMatch(this.createFinishedResultFromState());
    }
  }

  private finishMatch(result: IGameResult) {
    this.state.status = GameStatus.FINISHED;
    this.broadcast(MatchServerMessage.GAME_END, result);

    // Skip rating updates for custom rooms
    if (this.metadata.isCustomRoom) return;

    this.updateRatings(result).catch((err) => {
      logger.error(`[MatchRoom] Failed to update ratings: ${err}`);
    });
  }

  private createFinishedResultFromState(): IGameResult {
    const activeTeamIds = new Set<string>();
    for (const [, player] of this.state.players) {
      if (player.status === PlayerStatus.ACTIVE) {
        activeTeamIds.add(player.teamId);
      }
    }

    let winnerTeamId: string | null = null;
    if (activeTeamIds.size === 1) {
      for (const teamId of activeTeamIds) {
        winnerTeamId = teamId;
      }
    }

    return {
      mode: this.state.mode,
      winnerTeamId,
    };
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
        const entry = schemaQueue.queue[0];
        if (!entry) break;

        // Check if Rugby ball carrier is on cooldown
        if (this.game.mode === GameMode.RUGBY) {
          const rugbyGame = this.game as RugbyGame;
          const sourceCell = rugbyGame.grid.get({
            x: entry.fromX,
            y: entry.fromY,
          });
          if (sourceCell?.item?.type === ItemType.RUGBY_BALL) {
            const ball = sourceCell.item;
            const lastMoveTick =
              rugbyGame.lastBallMoveTickMap.get(ball.id) ?? -1;
            if (
              lastMoveTick >= 0 &&
              rugbyGame.tick - lastMoveTick < rugbyGame.rugbyMoveSpeedTicks
            ) {
              // Carrier is on cooldown, keep action in queue and stop processing for this player on this tick
              break;
            }
          }
        }

        schemaQueue.queue.shift();

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
        logger.debug(
          `[MatchRoom] Processing action: ${JSON.stringify(action)}`,
        );
        logger.debug(
          `[MatchRoom] Cell: ${JSON.stringify(this.game.grid.get({ x: entry.fromX, y: entry.fromY }))}`,
        );

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

      const publicPlayer = this.state.publicPlayers.get(playerId);

      if (state.teamId) {
        player.teamId = state.teamId;
        // Keep the public projection in lockstep with the authoritative engine
        // state so the scoreboard stays accurate for every connected client.
        if (publicPlayer) {
          publicPlayer.teamId = state.teamId;
        }
      }

      const prevStatus = player.status;
      player.status = state.status;
      if (publicPlayer) {
        publicPlayer.status = state.status;
      }

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

    syncScoreboard(
      this.state.scoreboard,
      this.game.getScoreboard(),
      this.state.publicPlayers.values(),
      this.state.tickInterval,
    );
  }

  private async updateRatings(result: IGameResult) {
    if (!this.isRatedMatch) {
      return;
    }

    const players = Array.from(this.state.players.values());
    if (players.length < 2) return;

    // Skip rating updates when bots are present
    const humanPlayers = players.filter(
      (p) => !this.metadata.playerInit.some((pi) => pi.id === p.id && pi.isBot),
    );
    if (humanPlayers.length < players.length) {
      logger.info(
        "[MatchRoom] Skipping rating update: room contains bot players",
      );
      return;
    }
    if (humanPlayers.length < 2) return;

    const mode = result.mode;

    const inputs = await Promise.all(
      humanPlayers.map(async (player) => {
        const currentRating = await userRepository.getRating(player.id, mode);
        const teamId = player.teamId;
        const placement = teamId === result.winnerTeamId ? 1 : 2;

        return {
          playerId: player.id,
          currentRating,
          placement,
        };
      }),
    );

    const results = calculateNewRatings(inputs, mode);

    await userRepository.updateRatings(
      results.map((r) => ({
        userId: r.playerId,
        mode,
        newRating: r.newRating,
      })),
    );

    logger.info(
      `[MatchRoom] Ratings updated for mode ${mode}: ${results.map((r) => `${r.playerId} ${r.oldRating}->${r.newRating}`).join(", ")}`,
    );
  }

  private updateClientView(client: Client) {
    if (!this.game) {
      logger.error(
        `[MatchRoom] Error: Game instance not found on updateClientView`,
      );
      throw new Error("Game instance not found");
    }

    const playerId = this.sessionToPlayerId.get(client.sessionId);
    if (!playerId || !client.view) return;

    const visionGrid = this.game.getVisionGrid(playerId);
    const vision = this.state.clientVisions.get(client.sessionId);
    if (!visionGrid || !vision) return;

    // Grid size changed (first update or map resize): full rebuild
    if (vision.cells.length !== visionGrid.totalCells) {
      vision.cells.clear();
      for (const vc of visionGrid) {
        vision.cells.push(this.createVisionCell(vc));
      }
      return;
    }

    // Incremental update: reuse existing cells, only mutate changed fields.
    // Iterate the IVisionGrid directly (no Array.from allocation).
    let i = 0;
    for (const vc of visionGrid) {
      const cell = vision.cells[i];

      if (cell.visibility !== vc.visibility) cell.visibility = vc.visibility;
      if (cell.terrain !== vc.terrain) cell.terrain = vc.terrain;

      const troopCount = vc.troopCount ?? -1;
      if (cell.troopCount !== troopCount) cell.troopCount = troopCount;

      const ownerIndex = vc.owner?.playerId ?? "";
      if (cell.ownerIndex !== ownerIndex) cell.ownerIndex = ownerIndex;

      const siteIndex = vc.siteIndex ?? -1;
      if (cell.siteIndex !== siteIndex) cell.siteIndex = siteIndex;

      const zoneIndex = vc.zoneIndex ?? -1;
      if (cell.zoneIndex !== zoneIndex) cell.zoneIndex = zoneIndex;

      if (cell.willCollapse !== vc.willCollapse)
        cell.willCollapse = vc.willCollapse;

      const itemId = vc.item?.id ?? "";
      const itemType = vc.item?.type ?? -1;
      if (cell.item_id !== itemId) cell.item_id = itemId;
      if (cell.item_type !== itemType) cell.item_type = itemType;

      i++;
    }
  }

  private createVisionCell(vc: IVisionCell): VisionCellSchema {
    const cell = new VisionCellSchema();
    cell.visibility = vc.visibility;
    cell.terrain = vc.terrain;
    cell.troopCount = vc.troopCount ?? -1;
    cell.ownerIndex = vc.owner?.playerId ?? "";
    cell.siteIndex = vc.siteIndex ?? -1;
    cell.zoneIndex = vc.zoneIndex ?? -1;
    cell.willCollapse = vc.willCollapse;

    if (vc.item) {
      cell.item_id = vc.item.id;
      cell.item_type = vc.item.type;
    } else {
      cell.item_id = "";
      cell.item_type = -1;
    }

    return cell;
  }
}
