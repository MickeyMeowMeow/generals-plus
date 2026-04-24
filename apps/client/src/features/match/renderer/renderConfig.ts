/**
 * Shared Pixi renderer constants for the first static grid pass.
 */
export const renderConfig = {
  stageBackground: 0x101318,
  stagePadding: 24,
  cellGap: 2,
  minCellSize: 8,
  maxCellSize: 34,
} as const;
