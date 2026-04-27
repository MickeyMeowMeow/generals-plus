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

  // Intent arrow
  arrowColor: 0x000000,
  arrowStrokeColor: 0xffffff,
  arrowStrokeWidth: 3,
  arrowLength: 44,
  arrowThickness: 7,
  arrowHeadSize: 22,

  // Troop count text
  troopTextFontFamily: "Arial, sans-serif",
  troopTextFontSizeRatio: 0.5, // Relative to cell size
  troopTextFontWeight: "bold",
  troopTextColor: 0x000000,
  troopTextStrokeColor: 0xffffff,
  troopTextStrokeWidth: 4,
} as const;
