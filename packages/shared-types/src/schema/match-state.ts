import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { GameMode, GameStatus } from "@generals-plus/engine";

import { Cell } from "#/schema/cell";
import { Player } from "#/schema/player";

export class MatchState extends Schema {
  @type("string") mode: GameMode = GameMode.CLASSIC;
  @type("string") status: GameStatus = GameStatus.NOT_STARTED;
  @type("number") tick: number = 0;

  @type("number") width: number = 0;
  @type("number") height: number = 0;

  @type([Cell]) grid = new ArraySchema<Cell>();
  @type({ map: Player }) players = new MapSchema<Player>();
}
