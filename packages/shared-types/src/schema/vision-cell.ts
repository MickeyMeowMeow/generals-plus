import { ArraySchema, Schema, type } from "@colyseus/schema";
import type { VisionTerrain } from "@generals-plus/engine";
import { HiddenTerrain, Visibility } from "@generals-plus/engine";

export class ItemSchema extends Schema {
  @type("string") id: string = "";
  @type("number") type: number = 0;
  @type("number") x: number = -1;
  @type("number") y: number = -1;
}

export class VisionCellSchema extends Schema {
  @type("string") visibility: Visibility = Visibility.HIDDEN;
  @type("string") terrain: VisionTerrain = HiddenTerrain;
  @type("number") troopCount: number = -1;
  @type("string") ownerIndex: string = "";
  @type("number") siteIndex: number = -1;
}

export class ClientVision extends Schema {
  @type([VisionCellSchema]) cells = new ArraySchema<VisionCellSchema>();
  @type([ItemSchema]) items = new ArraySchema<ItemSchema>();
}
