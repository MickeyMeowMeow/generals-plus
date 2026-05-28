import type {
  ICoordinate,
  Visibility,
  VisionTerrain,
} from "@generals-plus/engine";
import { HexGrid2D, SquareGrid2D } from "@generals-plus/engine";

export interface RenderGridCell {
  coordinate: ICoordinate;
  terrain: VisionTerrain;
  troopCount: number | null;
  visibility: Visibility;
  ownerIndex: string | null;
  siteIndex: number | null;
  item: { id: string; type: number } | null;
  willCollapse?: boolean;
}

export class SquareRenderGrid extends SquareGrid2D<RenderGridCell> {}

export class HexRenderGrid extends HexGrid2D<RenderGridCell> {}

export type RenderGrid = SquareRenderGrid | HexRenderGrid;
