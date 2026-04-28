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

  @type("number") mapWidth: number = 24;
  @type("number") mapHeight: number = 16;
  @type("number") seed: number = 0;
  @type("number") mountainRate: number = 0.12;
  @type("number") cityRate: number = 0.06;
  @type("number") minGeneralDistanceFactor: number = 0.6;
  @type("number") generalInitialTroops: number = 50;
  @type("number") cityInitialTroops: number = 50;
}
