/**
 * Shared Pixi renderer constants for the interactive grid renderer.
 */
export const RenderConfig = {
  // Global stage and grid sizing.
  stageBackground: 0x101318,
  stagePadding: 24,
  cellGap: 2,
  cellStride: 100,
  minScale: 0.25,
  maxScale: 1,
  terrainIconScale: 0.78,
  // Cell overlays and fog-of-war.
  ownerOverlayAlpha: 0.34,
  fogColor: 0x050608,
  fogAlpha: 1,
  neutralTroopColor: 0x242832,
  troopFontSize: 30,
  // Selection and interaction accents.
  selectionBorderColor: 0xf8fafc,
  hoverBorderColor: 0x38bdf8,
  selectionFillColor: 0x60a5fa,
  // Move queue arrow colors.
  fullMoveColor: 0xfbbf24,
  splitMoveColor: 0x38bdf8,
  queueLabelColor: 0x111827,
  // Pointer movement threshold (in world pixels) for drag selection.
  dragSelectThreshold: 6,
  // Common anchors and typography used across renderer components.
  centerAnchor: 0.5,
  fontFamily: "Arial, sans-serif",
  fontWeightBold: "700",
  textStrokeColor: 0xffffff,
  textStrokeWidth: 4,
  // Selection/hover visual tuning.
  selectionInset: 2,
  selectionStrokeWidth: 5,
  hoverInset: 4,
  hoverStrokeWidth: 4,
  hoverStrokeAlpha: 0.96,
  // Transparent filler used for hit areas and overlay clears.
  transparentColor: 0x000000,
  transparentAlpha: 0,
  // Move queue visuals
  moveHeadMinLength: 14,
  moveHeadScale: 0.18,
  moveHeadAngleOffset: Math.PI / 6,
  moveTrimFactor: 0.28,
  moveArrowSplitWidth: 5,
  moveArrowFullWidth: 8,
  moveSplitAlpha: 0.72,
  moveFullAlpha: 0.95,
  moveSplitMarkerRadius: 9,
  moveBadgeRadius: 18,
  moveBadgeStrokeWidth: 3,
  moveBadgeFillAlpha: 0.96,
  queueLabelFontSize: 20,
} as const;
