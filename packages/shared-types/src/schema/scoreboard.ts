import { ArraySchema, Schema, type } from "@colyseus/schema";

export class ScoreboardPlayerEntry extends Schema {
  @type("string") playerId: string = "";
  @type("number") troops: number = 0;
  @type("number") land: number = 0;
}

export class ClassicScoreboardPlayerEntry extends ScoreboardPlayerEntry {
  @type("boolean") isGeneralAlive: boolean = false;
}

export class BaseScoreboard extends Schema {
  @type("string") mode: string = "";
}

export class ClassicScoreboard extends BaseScoreboard {
  @type([ClassicScoreboardPlayerEntry]) players =
    new ArraySchema<ClassicScoreboardPlayerEntry>();
}
