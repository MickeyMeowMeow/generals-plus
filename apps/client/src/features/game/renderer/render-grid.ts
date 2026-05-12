import type { ICoordinate, Terrain, Visibility } from "@generals-plus/engine";
import { Grid2D } from "@generals-plus/engine";

export interface RenderGridCell {
  coordinate: ICoordinate;
  terrain: Terrain;
  troopCount: number | null;
  visibility: Visibility;
  ownerIndex: string | null;
}

export class RenderGrid extends Grid2D<RenderGridCell> {}
