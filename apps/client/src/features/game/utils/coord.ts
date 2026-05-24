import type { ICoordinate } from "@generals-plus/engine";

export function getCoordWorldPosition(
  coord: ICoordinate,
  stride: number,
  cellSize: number,
) {
  return {
    x: coord.x * stride + cellSize / 2,
    y: coord.y * stride + cellSize / 2,
  };
}
