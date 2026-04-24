import { Schema, type } from "@colyseus/schema";

// Aligned with engine Terrain enum values
export const Terrain = {
  PLAIN: "plain",
  GENERAL: "general",
  MOUNTAIN: "mountain",
  SWAMP: "swamp",
  DESERT: "desert",
  CITY: "city",
  VOID: "void",
} as const;

export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export class Cell extends Schema {
  @type("string") terrain: Terrain = Terrain.PLAIN;
  @type("boolean") isPassable: boolean = true;
  @type("number") troopCount: number = 0;
  /** Player index, -1 = unoccupied */
  @type("number") ownerIndex: number = -1;
}
