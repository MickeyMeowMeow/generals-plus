/**
 * Represents a coordinate on the grid.
 */
export interface ICoordinate {
  readonly x: number;
  readonly y: number;
}

/**
 * Checks whether two coordinates are the same (i.e., have the same x and y values).
 *
 * @param coord1 The first coordinate to compare.
 * @param coord2 The second coordinate to compare.
 *
 * @returns True if the coordinates are the same, false otherwise.
 */
export function isSameCoord(coord1: ICoordinate, coord2: ICoordinate): boolean {
  return coord1.x === coord2.x && coord1.y === coord2.y;
}

/**
 * Calculates the squared distance between two coordinates.
 *
 * @param coord1 The first coordinate.
 * @param coord2 The second coordinate.
 *
 * @returns The squared distance between the two coordinates.
 */
export function getSquaredDistance(
  coord1: ICoordinate,
  coord2: ICoordinate,
): number {
  const dx = Math.abs(coord1.x - coord2.x);
  const dy = Math.abs(coord1.y - coord2.y);
  return dx * dx + dy * dy;
}
