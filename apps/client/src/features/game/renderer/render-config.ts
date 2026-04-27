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
} as const;
