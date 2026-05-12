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

const DEFAULT_MAX_PLAYERS = 8;
const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_COUNTDOWN_CYCLES = 20;

export class MatchQueueRoom extends QueueRoom {
  declare state: QueueState;

  private gameMode: GameMode = GameMode.CLASSIC;
  private minPlayers = DEFAULT_MIN_PLAYERS;
  private queueState = new QueueState();

  onCreate(
    options: QueueOptions & {
      gameMode: GameMode;
      countdownCycles?: number;
    },
  ) {
    this.gameMode = options.gameMode ?? GameMode.CLASSIC;
    this.minPlayers = DEFAULT_MIN_PLAYERS;

    this.state = this.queueState;

    const queueOptions: QueueOptions = {
      matchRoomName: ROOM_NAMES.MATCH,
      maxPlayers: DEFAULT_MAX_PLAYERS,
      maxWaitingCycles: options.countdownCycles ?? DEFAULT_COUNTDOWN_CYCLES,
      allowIncompleteGroups: true,
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

  static async onAuth(token: string) {
    return JWT.verify(token);
  }

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
