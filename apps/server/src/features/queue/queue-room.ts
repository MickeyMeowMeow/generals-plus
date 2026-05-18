import { JWT } from "@colyseus/auth";
import type { Client, QueueOptions } from "@colyseus/core";
import { logger, matchMaker, QueueRoom } from "@colyseus/core";
import type { DominationGridOptions } from "@generals-plus/engine";
import { GameMode, getDefaultPlayersPerTeam } from "@generals-plus/engine";
import type { ClientAuth, RoomData } from "@generals-plus/shared-types";
import {
  isPaletteColor,
  nextAvailableColor,
  QueuePlayer,
  QueueState,
  ROOM_NAMES,
} from "@generals-plus/shared-types";

import { createGame, generateSeed } from "#/features/game/utils";
import { createPlayerInit } from "#/features/player/utils";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

const DEFAULT_MAX_PLAYERS = 8;
const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_COUNTDOWN_CYCLES = 20;
const RATING_TOLERANCE = 200;

const userRepository = new MongoUserRepository();

/**
 * Official matchmaking queue room.
 *
 * The client joins this room from the root `/` flow with a shared `ROOM_NAMES`
 * value and a concrete `GameMode`. The room tracks queue-only player state
 * (display name and selected color), groups ready clients through Colyseus'
 * `QueueRoom`, creates the authoritative match room metadata, and hands clients
 * off via seat reservations.
 */
export class MatchQueueRoom extends QueueRoom {
  declare state: QueueState;

  private gameMode: GameMode = GameMode.CLASSIC;
  private minPlayers = DEFAULT_MIN_PLAYERS;
  private queueState = new QueueState();

  onCreate(
    options: QueueOptions & {
      /** Official mode requested by the client, currently Classic only. */
      gameMode: GameMode;
      /** Test/dev override for how many queue cycles to wait before matching. */
      countdownCycles?: number;
    },
  ) {
    this.gameMode = options.gameMode ?? GameMode.CLASSIC;
    this.minPlayers = DEFAULT_MIN_PLAYERS;

    this.state = this.queueState;

    const queueOptions: QueueOptions = {
      matchRoomName: ROOM_NAMES.MATCH,
      maxPlayers: options.maxPlayers ?? DEFAULT_MAX_PLAYERS,
      maxWaitingCycles: options.countdownCycles ?? DEFAULT_COUNTDOWN_CYCLES,
      allowIncompleteGroups: true,
      compare: (clientData, group) => {
        const diff = Math.abs(clientData.rank - group.averageRank);
        return diff <= RATING_TOLERANCE;
      },
      onGroupReady: async (group) => {
        const groupPlayerIds = group.clients.map(
          (c: Client) => (c.auth as ClientAuth).id,
        );
        const groupPlayers = this.state.players.filter((p) =>
          groupPlayerIds.includes(p.id),
        );

        const gridOptions =
          this.gameMode === GameMode.DOMINATION
            ? ({
                generalCount: groupPlayers.length,
                flagCount: 3,
                seed: generateSeed(),
              } as DominationGridOptions)
            : { generalCount: groupPlayers.length, seed: generateSeed() };

        const game = createGame({
          mode: this.gameMode,
          gridOptions,
          playerIds: groupPlayers.map((p) => p.id),
          playerPerTeam: getDefaultPlayersPerTeam(this.gameMode),
        });

        const playerInit = createPlayerInit(groupPlayers, game);

        const metadata: RoomData = {
          mode: this.gameMode,
          game,
          playerInit,
        };

        return matchMaker.createRoom(ROOM_NAMES.MATCH, { metadata });
      },
    };

    super.onCreate(queueOptions);

    this.onMessage("pickColor", (client, message: { color: number }) => {
      const auth = client.auth as ClientAuth;
      const player = this.queueState.players.find(
        (p: QueuePlayer) => p.id === auth.id,
      );
      if (!player) return;

      if (!isPaletteColor(message.color)) {
        client.send("error", "invalid color");
        return;
      }

      const taken = this.queueState.players.find(
        (p: QueuePlayer) => p.id !== auth.id && p.color === message.color,
      );
      if (taken) {
        client.send("error", "color already taken");
        return;
      }

      player.color = message.color;
    });
  }

  /**
   * Prevent Colyseus from forming a group until the official minimum is reached.
   *
   * `allowIncompleteGroups` is still enabled so a group can start without
   * filling the room to its max size after the minimum threshold has been met.
   * While below the threshold we reset client cycles to keep everyone queued.
   */
  reassignMatchGroups() {
    if (this.clients.length < this.minPlayers) {
      for (const client of this.clients) {
        if (client.userData) {
          client.userData.currentCycle = 0;
        }
      }
      return;
    }

    // Replicate Colyseus QueueRoom.reassignMatchGroups but enforce minPlayers
    // per group, since the built-in evaluateHighPriorityGroups can mark
    // undersized groups as ready and trigger onGroupReady before we can stop it.
    (this.groups as unknown[]).length = 0;
    (this.highPriorityGroups as unknown[]).length = 0;

    const sortedClients = this.clients
      .filter(
        (client: Client) =>
          client.userData && client.userData.group?.ready !== true,
      )
      .sort((a: Client, b: Client) => a.userData.rank - b.userData.rank);

    this.redistributeClients(sortedClients);
    this.evaluateMinPlayersForPriorityGroups();
    this.processGroupsReady();
  }

  private evaluateMinPlayersForPriorityGroups() {
    for (const group of this
      .highPriorityGroups as (typeof this.groups)[number][]) {
      if (group.clients.length < this.minPlayers) {
        // Reset wait time so these clients continue waiting instead of being ready
        for (const client of group.clients) {
          if (client.userData) {
            client.userData.currentCycle = 0;
          }
        }
        continue;
      }
      group.ready = group.clients.every(
        (c: Client) => c.userData?.currentCycle > 1,
      );
    }
  }

  /** Verify the client auth token before allowing queue participation. */
  static async onAuth(token: string) {
    return JWT.verify(token);
  }

  /**
   * Add a player to queue state and kick older duplicate sessions.
   *
   * Queue state is intentionally smaller than match state; it only contains the
   * information needed by the lobby UI before a real match room exists.
   */
  async onJoin(client: Client) {
    const auth = client.auth as ClientAuth;
    const existingClient = this.clients.find(
      (c) =>
        c.sessionId !== client.sessionId &&
        (c.auth as ClientAuth).id === auth.id,
    );
    if (existingClient) {
      logger.info(
        `[MatchQueueRoom] Duplicate connection for ${auth.displayName}, kicking old session ${existingClient.sessionId}`,
      );
      existingClient.leave(4000);
    }

    const rating = await userRepository.getRating(auth.id, this.gameMode);

    const player = new QueuePlayer();
    player.id = auth.id;
    player.displayName = auth.displayName ?? "Player";
    player.color =
      nextAvailableColor(
        this.queueState.players.map((p: QueuePlayer) => p.color),
      ) ?? 0;
    this.queueState.players.push(player);

    super.onJoin(client, { rank: rating });
  }

  /** Remove a leaving player's queue presentation state. */
  onLeave(client: Client) {
    const auth = client.auth as ClientAuth;
    const idx = this.queueState.players.findIndex(
      (p: QueuePlayer) => p.id === auth.id,
    );
    if (idx !== -1) {
      this.queueState.players.splice(idx, 1);
    }
  }
}
