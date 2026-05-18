/**
 * Shared Pixi renderer constants for the first static grid pass.
 */
export const RenderConfig = {
  // Stage
  stageBackground: 0x111111,
  stagePadding: 24,
  initialMaxScale: 0.6,
  initialFitRatio: 0.8,
  initialHudReserveRight: 120,
  initialHudReserveTop: 60,
  minScale: 0.08,
  maxScale: 1,

  // Grid
  cellGap: 2,
  cellStride: 100,

  // Terrain icons
  terrainIconScale: 0.78,

  // Troop count text
  troopTextFontFamily: "Oxanium Variable, sans-serif",
  troopTextFontSizeRatio: 0.33, // Relative to cell size
  troopTextFontWeight: "400",
  troopTextColor: 0xffffff,
  troopTextStrokeColor: 0x000000,
  troopTextStrokeWidth: 4,
  troopTextShadowColor: 0x000000,
  troopTextShadowAlpha: 0.7,
  troopTextShadowBlur: 10,
  troopTextShadowDistance: 0,
  troopTextShadowAngle: 0,

  // Intent arrow
  arrowColor: 0xffffff,
  arrowStrokeColor: 0x000000,
  arrowStrokeWidth: 0,
  splitArrowBarWidth: 3.5,
  splitArrowBarLength: 12,
  splitArrowBarInset: 10,
  arrowLength: 30,
  arrowThickness: 3,
  arrowHeadSize: 10,
} as const;
