import type {
  ICoordinate,
  Visibility,
  VisionTerrain,
} from "@generals-plus/engine";
import { SquareGrid2D } from "@generals-plus/engine";

export interface RenderGridCell {
  coordinate: ICoordinate;
  terrain: VisionTerrain;
  troopCount: number | null;
  visibility: Visibility;
  ownerIndex: string | null;
}

export class SquareRenderGrid extends SquareGrid2D<RenderGridCell> {}

export type RenderGrid = SquareRenderGrid;
