import { ArraySchema, Schema, type } from "@colyseus/schema";
import type { GameMode } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";

export class SetupPlayer extends Schema {
  @type("string") id: string = "";
  @type("string") displayName: string = "";
  @type("boolean") isHost: boolean = false;
  @type("number") color: number = 0;
  @type("string") teamId: string = "";
}

export class SetupState extends Schema {
  @type("string") gameMode: GameMode = "classic";
  @type("string") hostId: string = "";
  @type("boolean") isPublic: boolean = true;
  @type([SetupPlayer]) players = new ArraySchema<SetupPlayer>();
  @type("number") maxPlayers: number = 8;
  @type("number") playersPerTeam: number = 2;

  @type("string") mapType: GridType = GridType.SQUARE;

  // Map dimensions for square maps
  @type("number") mapWidth: number = 24;
  @type("number") mapHeight: number = 16;

  // Map dimensions for hex maps
  @type("number") mapLeft: number = 10;
  @type("number") mapRight: number = 10;
  @type("number") mapLeftSlant: number = 19;
  @type("number") mapRightSlant: number = 19;

  @type("number") seed: number = 0;
  @type("number") mountainRate: number = 0.12;
  @type("number") cityRate: number = 0.06;
  @type("number") minGeneralDistanceFactor: number = 0.6;
  @type("number") generalInitialTroops: number = 50;
  @type("number") cityInitialTroops: number = 50;

  @type("number") speed: number = 1;
  @type("number") duration: number = 1;
  @type("number") flagCount: number = 3;
  @type("number") targetScore: number = 1000;
  @type("number") bombSiteCount: number = 2;
  @type("number") plantDuration: number = 3;
  @type("number") defuseDuration: number = 5;
  @type("number") detonateDuration: number = 45;

  @type("number") collapseInterval: number = 30;
  @type("number") startDelay: number = 60;
  @type("string") collapseShape: string = "circle";

  @type("number") tickInterval: number = 500;
  @type("number") finishTick: number = 360;
}
