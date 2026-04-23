export const ItemType = {
  BOMB: 0, // Demolition mode
  RUGBY_BALL: 1, // Rugby mode
  FLAG: 2, // CTF mode
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

/**
 * Represents a carryable object on the grid.
 */
export interface IItem {
  /** Type of the item, determining its behavior and effects. */
  readonly type: ItemType;
  /** Unique ID to track the specific item across the grid. */
  readonly id: string;
}
