/**
 * Shared Pixi renderer constants for the first static grid pass.
 */
export const RenderConfig = {
  // Stage
  stageBackground: 0x111111,
  stagePadding: 24,
  initialMaxScale: 0.72,
  initialFitRatio: 0.92,
  minScale: 0.08,
  maxScale: 1,

  // Grid
  cellGap: 2,
  cellStride: 100,

  // Terrain icons
  terrainIconScale: 0.78,

  // Troop count text
  troopTextFontFamily: "Arial, sans-serif",
  troopTextFontSizeRatio: 0.5, // Relative to cell size
  troopTextFontWeight: "bold",
  troopTextColor: 0x000000,
  troopTextStrokeColor: 0xffffff,
  troopTextStrokeWidth: 4,

  // Intent arrow
  arrowColor: 0x000000,
  arrowStrokeColor: 0xffffff,
  arrowStrokeWidth: 3,
  arrowLength: 44,
  arrowThickness: 7,
  arrowHeadSize: 22,
} as const;
