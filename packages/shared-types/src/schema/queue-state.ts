import { ArraySchema, Schema, type } from "@colyseus/schema";

export class QueuePlayer extends Schema {
  @type("string") id: string = "";
  @type("string") username: string = "";
  @type("number") color: number = 0;
}

export class QueueState extends Schema {
  @type([QueuePlayer]) players = new ArraySchema<QueuePlayer>();
}
