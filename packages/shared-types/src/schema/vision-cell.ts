import { Schema, type } from "@colyseus/schema";

export class ClientVision extends Schema {
  @type(["string"]) visibility: string[] = [];
  @type(["string"]) terrain: string[] = [];
  @type(["number"]) troopCount: number[] = [];
  @type(["number"]) ownerIndex: number[] = [];
}
