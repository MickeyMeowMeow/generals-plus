import type { ItemType } from "#/domain/item/item-type";
import type { ICoordinate } from "#/math/coordinate";

/**
 * Represents a carryable object on the grid.
 */
export interface IItem {
  /** Type of the item, determining its behavior and effects. */
  readonly type: ItemType;
  /** Unique ID to track the specific item across the grid. */
  readonly id: string;
  /** Current coordinate of the item on the grid. */
  coordinate: ICoordinate;
}
