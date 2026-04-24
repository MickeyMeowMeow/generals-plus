import { Schema, type } from "@colyseus/schema";
import { Terrain } from "@generals-plus/engine";

export class Cell extends Schema {
  @type("string") terrain: Terrain = Terrain.PLAIN;
  @type("boolean") isPassable: boolean = true;
  @type("number") troopCount: number = 0;
  /** Player index, -1 = unoccupied */
  @type("number") ownerIndex: number = -1;
}
