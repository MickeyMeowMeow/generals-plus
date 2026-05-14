import { JWT } from "@colyseus/auth";
import type { Client, QueueOptions } from "@colyseus/core";
import { logger, matchMaker, QueueRoom } from "@colyseus/core";
import { GameMode } from "@generals-plus/engine";
import type {
  ClientAuth,
  PlayerInit,
  RoomData,
} from "@generals-plus/shared-types";
import {
  isPaletteColor,
  nextAvailableColor,
  PLAYER_COLOR_PALETTE,
  QueuePlayer,
  QueueState,
  ROOM_NAMES,
} from "@generals-plus/shared-types";

import { createGame } from "#/features/game/utils";

const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_COUNTDOWN_CYCLES = 0;

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
      maxPlayers: options.maxPlayers ?? this.minPlayers,
      maxWaitingCycles: options.countdownCycles ?? DEFAULT_COUNTDOWN_CYCLES,
      allowIncompleteGroups: true,
      /**
       * Convert the queued Colyseus clients into match-room metadata.
       *
       * Queue membership is the source of truth for official matches. The match
       * room receives a pre-created engine game plus `playerInit` so colors and
       * display names remain aligned with the queue UI during the seat handoff.
       */
      onGroupReady: async (group) => {
        const playerInit: PlayerInit[] = group.clients.map((client, i) => {
          const auth = client.auth as ClientAuth;
          const queuePlayer = this.queueState.players.find(
            (p: QueuePlayer) => p.id === auth.id,
          );
          return {
            id: auth.id,
            displayName: auth.displayName ?? `Player_${i + 1}`,
            teamId: `team_${i}`,
            color:
              queuePlayer?.color ??
              PLAYER_COLOR_PALETTE[i % PLAYER_COLOR_PALETTE.length],
          };
        });

        const game = createGame({
          mode: this.gameMode,
          playerIds: playerInit.map((p) => p.id),
        });

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

    super.reassignMatchGroups();
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
  onJoin(client: Client, options: { rank?: number }) {
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

    const player = new QueuePlayer();
    player.id = auth.id;
    player.displayName = auth.displayName ?? "Player";
    player.color =
      nextAvailableColor(
        this.queueState.players.map((p: QueuePlayer) => p.color),
      ) ?? 0;
    this.queueState.players.push(player);

    super.onJoin(client, { rank: options.rank ?? 0 });
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
