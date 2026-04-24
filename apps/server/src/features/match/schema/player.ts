import { Schema, type } from "@colyseus/schema";

// Aligned with engine PlayerStatus enum values
export const PlayerStatus = {
  ACTIVE: "active",
  ELIMINATED: "eliminated",
} as const;

export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];

export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") status: PlayerStatus = PlayerStatus.ACTIVE;
  @type("string") teamId: string = "";
  @type("string") username: string = "";
  @type("number") landCount: number = 0;
  @type("number") armyCount: number = 0;
}
