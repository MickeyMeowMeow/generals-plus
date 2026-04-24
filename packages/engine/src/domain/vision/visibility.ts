export const Visibility = {
  /** Completely unknown cell, no information available. */
  HIDDEN: "hidden",
  /** Shrouded cell, e.g. known to be either a mountain or a city, but not which. */
  SHROUDED: "shrouded",
  /** Only terrain type is known, no troop or ownership information. */
  TERRAIN: "terrain",
  /** Completely known cell, all information available. */
  VISIBLE: "visible",
} as const;

export type Visibility = (typeof Visibility)[keyof typeof Visibility];
