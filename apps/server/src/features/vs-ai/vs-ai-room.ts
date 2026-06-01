/**
 * VsAiRoom: instant 1v1 vs AI bot match.
 *
 * Player joins → immediately creates a Classic match with 1 human + 1 bot.
 * No queue, no waiting, no rating updates.
 * The bot player is marked with `isBot: true` so MatchRoom handles it.
 */

import { JWT } from "@colyseus/auth";
import type { Client } from "@colyseus/core";
import { logger, matchMaker, Room } from "@colyseus/core";
import { GameMode, GridType } from "@generals-plus/engine";
import type { ClientAuth, RoomData } from "@generals-plus/shared-types";
import {
  QueueClientMessage,
  QueueServerMessage,
  ROOM_NAMES,
} from "@generals-plus/shared-types";

import { createGame, generateSeed } from "#/features/game/utils";
import { MODE_SETTINGS } from "#/features/match/utils";
import { MongoSystemSettingsRepository } from "#/infra/db/repositories/MongoSystemSettingsRepository";

const BOT_PLAYER_ID = "__bot__";
const BOT_DISPLAY_NAME = "AI Bot";
const TICK_INTERVAL = 500;

// Map size must fall within training data range (17–23) so the AI model
// operates on grid sizes it was trained / pre-trained on.
// Locked to 18×18 — matches the RL training default and has the most SFT data.
const MAP_WIDTH = 18;
const MAP_HEIGHT = 18;

export class VsAiRoom extends Room {
  async onCreate() {
    this.maxClients = 1;
    await this.setPrivate(true);
  }

  static async onAuth(token: string) {
    return JWT.verify(token);
  }

  async onJoin(client: Client) {
    if (process.env.NODE_ENV !== "test") {
      const systemSettingsRepository = new MongoSystemSettingsRepository();
      const settings = await systemSettingsRepository.getSettings();

      const matchRooms = await matchMaker.query({ name: ROOM_NAMES.MATCH });
      const totalRoomsCount = matchRooms.length;

      if (totalRoomsCount >= settings.maxTotalRooms) {
        throw new Error(
          `Server rooms limit reached (${settings.maxTotalRooms}). Cannot start AI game.`,
        );
      }

      const vsAiRoomsCount = matchRooms.filter((room) =>
        room.metadata?.playerInit?.some(
          (player: { isBot?: boolean }) => player.isBot,
        ),
      ).length;

      if (vsAiRoomsCount >= settings.maxVsAiRooms) {
        throw new Error(
          `AI rooms limit reached (${settings.maxVsAiRooms}). Cannot start AI game.`,
        );
      }
    }

    const auth = client.auth as ClientAuth;
    const userId = auth.id;
    const displayName = auth.displayName ?? "Player";

    const modeDefaults = MODE_SETTINGS[GameMode.CLASSIC];
    const game = createGame({
      mode: GameMode.CLASSIC,
      gridOptions: {
        gridType: GridType.SQUARE,
        gridBounds: { width: MAP_WIDTH, height: MAP_HEIGHT },
        seed: generateSeed(),
        mountainRate: 0.2,
        cityRate: 0.05,
        generalCount: 2,
        minGeneralDistanceFactor: 0.6,
        generalInitialTroops: modeDefaults?.generalInitialTroops ?? 1,
      },
      playerIds: [userId, BOT_PLAYER_ID],
      playerPerTeam: 1,
    });

    const humanTeamId = game.players.get(userId)?.team.teamId ?? "team_0";
    const botTeamId = game.players.get(BOT_PLAYER_ID)?.team.teamId ?? "team_1";

    const playerInit = [
      { id: userId, displayName, teamId: humanTeamId, color: 0xe74c3c },
      {
        id: BOT_PLAYER_ID,
        displayName: BOT_DISPLAY_NAME,
        teamId: botTeamId,
        color: 0x3498db,
        isBot: true,
      },
    ];

    const metadata: RoomData = {
      mode: GameMode.CLASSIC,
      game,
      playerInit,
      isPublic: false,
      tickInterval: TICK_INTERVAL,
    };

    const room = await matchMaker.createRoom(ROOM_NAMES.MATCH, { metadata });

    await matchMaker.reserveMultipleSeatsFor(room, [
      { sessionId: client.sessionId, options: undefined, auth: client.auth },
    ]);

    client.send(
      QueueServerMessage.SEAT_RESERVATION,
      matchMaker.buildSeatReservation(room, client.sessionId),
    );

    // Listen for client confirmation (same pattern as QueueRoom)
    this.onMessage(QueueClientMessage.CONFIRM, () => {
      // Client confirmed seat, room will be cleaned up automatically
    });

    logger.info(`[VsAiRoom] Created bot match for ${displayName}`);
  }
}
