import { Schema, type } from "@colyseus/schema";
import { PlayerStatus } from "@generals-plus/engine";

export class PublicPlayer extends Schema {
  @type("string") id: string = "";
  @type("string") status: PlayerStatus = PlayerStatus.ACTIVE;
  @type("string") teamId: string = "";
  @type("string") displayName: string = "";
  @type("number") color: number = 0;
}
