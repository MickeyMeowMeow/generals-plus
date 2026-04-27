import { ArraySchema, Schema, type } from "@colyseus/schema";

export class ClientVision extends Schema {
  @type(["string"]) visibility = new ArraySchema<string>();
  @type(["string"]) terrain = new ArraySchema<string>();
  @type(["number"]) troopCount = new ArraySchema<number>();
  @type(["number"]) ownerIndex = new ArraySchema<number>();
}
