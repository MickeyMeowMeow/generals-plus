import type { ICoordinate } from "@generals-plus/engine";

export function isSameCoord(
  a: ICoordinate | null,
  b: ICoordinate | null,
): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

export function isCoordInBounds(
  coord: ICoordinate,
  width: number,
  height: number,
): boolean {
  return coord.x >= 0 && coord.x < width && coord.y >= 0 && coord.y < height;
}
