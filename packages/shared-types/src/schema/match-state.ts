import { MapSchema, Schema, type, view } from "@colyseus/schema";
import { GameMode, GameStatus } from "@generals-plus/engine";

import { ClientActionQueue } from "#/schema/action-data";
import { Player } from "#/schema/player";
import { BaseScoreboard } from "#/schema/scoreboard";
import { ClientVision } from "#/schema/vision-cell";

export class MatchState extends Schema {
  @type("string") mode: GameMode = GameMode.CLASSIC;
  @type("string") status: GameStatus = GameStatus.NOT_STARTED;
  @type("number") tick: number = 0;

  @type("number") width: number = 0;
  @type("number") height: number = 0;

  @type({ map: "number" }) playerColors = new MapSchema<number>();

  @view() @type({ map: ClientActionQueue }) clientActionQueues =
    new MapSchema<ClientActionQueue>();
  @view() @type({ map: ClientVision }) clientVisions =
    new MapSchema<ClientVision>();
  @view() @type({ map: Player }) players = new MapSchema<Player>();

  @type(BaseScoreboard) scoreboard: BaseScoreboard = new BaseScoreboard();
}
