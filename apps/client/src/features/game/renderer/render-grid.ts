import type {
  GridShape,
  ICoordinate,
  VisionTerrain,
} from "@generals-plus/engine";
import {
  GridType,
  HexGrid2D,
  ItemType,
  SquareGrid2D,
  Terrain,
  Visibility,
} from "@generals-plus/engine";
import type { VisionCellSchema } from "@generals-plus/shared-types";

export interface RenderGridCell {
  coordinate: ICoordinate;
  terrain: VisionTerrain;
  troopCount: number | null;
  visibility: Visibility;
  ownerIndex: string | null;
  siteIndex: number | null;
  zoneIndex: number | null;
  item: { id: string; type: number } | null;
  willCollapse?: boolean;
}

export class SquareRenderGrid extends SquareGrid2D<RenderGridCell> {}

export class HexRenderGrid extends HexGrid2D<RenderGridCell> {}

export type RenderGrid = SquareRenderGrid | HexRenderGrid;

export function createRenderGrid(shape: GridShape): RenderGrid {
  const createNullCell = (coordinate: ICoordinate): RenderGridCell => ({
    coordinate,
    visibility: Visibility.HIDDEN,
    terrain: Terrain.VOID,
    troopCount: null,
    ownerIndex: null,
    siteIndex: null,
    zoneIndex: null,
    item: null,
  });

  switch (shape.gridType) {
    case GridType.SQUARE: {
      return SquareRenderGrid.generate<RenderGridCell>(
        shape.width,
        shape.height,
        createNullCell,
      );
    }
    case GridType.HEX: {
      return HexRenderGrid.generate<RenderGridCell>(
        shape.left,
        shape.right,
        shape.leftSlant,
        shape.rightSlant,
        createNullCell,
      );
    }
  }
}

export function updateRenderGrid(
  grid: RenderGrid,
  visionCells: VisionCellSchema[],
): {
  bombMoved: boolean;
} {
  let bombMoved = false;

  const createVisionCell = (
    newVision: VisionCellSchema,
    currentCell: RenderGridCell,
    coordinate: ICoordinate,
  ) => {
    bombMoved ||=
      (newVision.item_type === ItemType.BOMB ||
        currentCell.item?.type === ItemType.BOMB ||
        newVision.item_type === ItemType.RUGBY_BALL ||
        currentCell.item?.type === ItemType.RUGBY_BALL) &&
      newVision.item_id !== currentCell.item?.id;

    return {
      coordinate,
      visibility: newVision.visibility,
      terrain: newVision.terrain,
      troopCount: newVision.troopCount === -1 ? null : newVision.troopCount,
      ownerIndex: newVision.ownerIndex || null,
      siteIndex: newVision.siteIndex === -1 ? null : newVision.siteIndex,
      zoneIndex: newVision.zoneIndex === -1 ? null : newVision.zoneIndex,
      item:
        newVision.item_type !== -1
          ? { id: newVision.item_id, type: newVision.item_type }
          : null,
      willCollapse: newVision.willCollapse,
    };
  };

  grid.updateFromArray(visionCells, createVisionCell);
  return { bombMoved };
}
