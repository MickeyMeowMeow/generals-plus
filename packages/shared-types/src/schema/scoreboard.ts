import { ArraySchema, Schema, type } from "@colyseus/schema";

export class BaseScoreboardPlayerEntry extends Schema {
  @type("string") playerId: string = "";
  @type("string") teamId: string = "";
}

export class TroopLandScoreboardPlayerEntry extends BaseScoreboardPlayerEntry {
  @type("number") troops: number = 0;
  @type("number") land: number = 0;
}

export class ClassicScoreboardPlayerEntry extends TroopLandScoreboardPlayerEntry {
  @type("boolean") isAlive: boolean = false;
}

export abstract class BaseScoreboard extends Schema {
  @type("string") mode: string = "";
}

export class ClassicScoreboard extends BaseScoreboard {
  @type([ClassicScoreboardPlayerEntry]) players =
    new ArraySchema<ClassicScoreboardPlayerEntry>();
}
