import { JWT } from "@colyseus/auth";
import type { Client, QueueOptions } from "@colyseus/core";
import { matchMaker, QueueRoom } from "@colyseus/core";
import { GameMode } from "@generals-plus/engine";
import type {
  ClientAuth,
  MapGenerator,
  PlayerInit,
  RoomData,
} from "@generals-plus/shared-types";
import { RoomNames } from "@generals-plus/shared-types";

import { DefaultMapGenerator } from "#/features/queue/default-map-generator";

// TODO: Move to @generals-plus/engine GameModeConfig once available
const DEFAULT_MAX_PLAYERS = 8;
const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_COUNTDOWN_CYCLES = 20;

export class MatchQueueRoom extends QueueRoom {
  private gameMode: GameMode = GameMode.CLASSIC;
  private minPlayers = DEFAULT_MIN_PLAYERS;
  private mapGenerator: MapGenerator = new DefaultMapGenerator();

  onCreate(
    options: QueueOptions & {
      gameMode: GameMode;
      countdownCycles?: number;
    },
  ) {
    this.gameMode = options.gameMode;
    this.minPlayers = DEFAULT_MIN_PLAYERS;

    const queueOptions: QueueOptions = {
      matchRoomName: RoomNames.MATCH,
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

        const metadata: RoomData = {
          mode: this.gameMode,
          map: this.mapGenerator.generate(this.gameMode, playerInit.length),
          playerInit,
        };

        return matchMaker.createRoom(RoomNames.MATCH, { metadata });
      },
    };

    super.onCreate(queueOptions);
  }

  reassignMatchGroups() {
    if (this.clients.length < this.minPlayers) {
      // Not enough players yet — reset all cycle counters so no countdown accumulates
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
