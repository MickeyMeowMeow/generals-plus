import { Schema, type } from "@colyseus/schema";
import { PlayerStatus } from "@generals-plus/engine";

export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") status: PlayerStatus = PlayerStatus.ACTIVE;
  @type("string") teamId: string = "";
  @type("string") username: string = "";
  @type("number") landCount: number = 0;
  @type("number") armyCount: number = 0;
  @type("string") sessionId: string = "";
}
