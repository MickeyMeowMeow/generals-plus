import { ArraySchema, Schema, type } from "@colyseus/schema";
import type { VisionTerrain } from "@generals-plus/engine";
import { HiddenTerrain, Visibility } from "@generals-plus/engine";

export class VisionCellSchema extends Schema {
  @type("string") visibility: Visibility = Visibility.HIDDEN;
  @type("string") terrain: VisionTerrain = HiddenTerrain;
  @type("number") troopCount: number = -1;
  @type("string") ownerIndex: string = "";
}

export class ClientVision extends Schema {
  @type([VisionCellSchema]) cells = new ArraySchema<VisionCellSchema>();
}
