import { ArraySchema, Schema, type } from "@colyseus/schema";

export class ActionData extends Schema {
  @type("string") type: string = "";
  @type("number") fromX: number = 0;
  @type("number") fromY: number = 0;
  @type("number") toX: number = 0;
  @type("number") toY: number = 0;
}

export class ClientActionQueue extends Schema {
  @type([ActionData]) queue = new ArraySchema<ActionData>();
}
