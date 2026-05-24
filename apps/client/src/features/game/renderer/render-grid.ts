import type { ICoordinate, Terrain, Visibility } from "@generals-plus/engine";
import { SquareGrid } from "@generals-plus/engine";

export interface RenderGridCell {
  coordinate: ICoordinate;
  terrain: Terrain;
  troopCount: number | null;
  visibility: Visibility;
  ownerIndex: string | null;
}

export class RenderGrid extends SquareGrid<RenderGridCell> {}
