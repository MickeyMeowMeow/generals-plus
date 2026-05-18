import { MapSchema, Schema, type, view } from "@colyseus/schema";
import { GameMode, GameStatus } from "@generals-plus/engine";

import { ClientActionQueue } from "#/schema/action-data";
import { Player } from "#/schema/player";
import { PublicPlayer } from "#/schema/public-player";
import { BaseScoreboard, ClassicScoreboard } from "#/schema/scoreboard";
import { ClientVision } from "#/schema/vision-cell";

export class MatchState extends Schema {
  @type("string") mode: GameMode = GameMode.CLASSIC;
  @type("string") status: GameStatus = GameStatus.NOT_STARTED;
  @type("number") tick: number = 0;
  @type("number") tickInterval: number = 500;
  @type("number") finishTick: number = -1;
  @type("number") targetScore: number = -1;

  @type("number") width: number = 0;
  @type("number") height: number = 0;

  // Shared metadata that every client can see without exposing the full
  // per-player server state kept in `players`.
  @type({ map: PublicPlayer }) publicPlayers = new MapSchema<PublicPlayer>();

  @view() @type({ map: ClientActionQueue }) clientActionQueues =
    new MapSchema<ClientActionQueue>();
  @view() @type({ map: ClientVision }) clientVisions =
    new MapSchema<ClientVision>();
  @view() @type({ map: Player }) players = new MapSchema<Player>();

  @type(BaseScoreboard) scoreboard: BaseScoreboard = new ClassicScoreboard();
}
