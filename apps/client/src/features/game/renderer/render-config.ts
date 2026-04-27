/**
 * Shared Pixi renderer constants for the first static grid pass.
 */
export const RenderConfig = {
  stageBackground: 0x101318,
  stagePadding: 24,
  cellGap: 2,
  cellStride: 100,
  minScale: 0.25,
  maxScale: 1,
  terrainIconScale: 0.78,
} as const;
