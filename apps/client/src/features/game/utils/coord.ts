import type { ICoordinate } from "@generals-plus/engine";

export function isSameCoord(
  a: ICoordinate | null,
  b: ICoordinate | null,
): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}
