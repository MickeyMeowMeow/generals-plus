import { JWT } from "@colyseus/auth";
import type { Client, QueueOptions } from "@colyseus/core";
import { matchMaker, QueueRoom } from "@colyseus/core";
import { GameMode } from "@generals-plus/engine";
import type {
  ClientAuth,
  PlayerInit,
  RoomData,
} from "@generals-plus/shared-types";
import { ROOM_NAMES } from "@generals-plus/shared-types";

import { createGame } from "#/features/game-factory";

const DEFAULT_MAX_PLAYERS = 8;
const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_COUNTDOWN_CYCLES = 20;

export class MatchQueueRoom extends QueueRoom {
  private gameMode: GameMode = GameMode.CLASSIC;
  private minPlayers = DEFAULT_MIN_PLAYERS;

  onCreate(
    options: QueueOptions & {
      gameMode: GameMode;
      countdownCycles?: number;
    },
  ) {
    this.gameMode = options.gameMode;
    this.minPlayers = DEFAULT_MIN_PLAYERS;

    const queueOptions: QueueOptions = {
      matchRoomName: ROOM_NAMES.MATCH,
      maxPlayers: DEFAULT_MAX_PLAYERS,
      maxWaitingCycles: options.countdownCycles ?? DEFAULT_COUNTDOWN_CYCLES,
      allowIncompleteGroups: true,
      onGroupReady: async (group) => {
        const playerInit: PlayerInit[] = group.clients.map((client, i) => {
          const auth = client.auth as ClientAuth;
          return {
            id: auth.id,
            username: auth.username ?? `Player_${i + 1}`,
            teamId: `team_${i}`,
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
    super.onJoin(client, { rank: options.rank ?? 0 });
  }
}
