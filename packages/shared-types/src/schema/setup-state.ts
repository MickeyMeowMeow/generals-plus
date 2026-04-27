import { ArraySchema, Schema, type } from "@colyseus/schema";
import type { GameMode } from "@generals-plus/engine";

export class SetupPlayer extends Schema {
  @type("string") id: string = "";
  @type("string") username: string = "";
  @type("boolean") isHost: boolean = false;
}

export class SetupState extends Schema {
  @type("string") gameMode: GameMode = "classic";
  @type("string") hostId: string = "";
  @type("boolean") isPublic: boolean = true;
  @type([SetupPlayer]) players = new ArraySchema<SetupPlayer>();
  @type("number") maxPlayers: number = 8;
}
