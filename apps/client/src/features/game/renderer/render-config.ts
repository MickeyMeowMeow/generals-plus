/**
 * Shared Pixi renderer constants for the first static grid pass.
 */
export const RenderConfig = {
  // Stage
  stageBackground: 0x101318,
  stagePadding: 24,
  minScale: 0.25,
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

  // Scoreboard layout
  scoreboardPanelX: 0,
  scoreboardPanelY: 0,
  scoreboardMargin: 16,
  scoreboardWidth: 260,
  scoreboardHeaderHeight: 28,
  scoreboardRowHeight: 26,
  scoreboardMaxVisibleRows: 10,
  scoreboardFirstVisibleRowIndex: 0,
  scoreboardRankOffset: 1,
  scoreboardHorizontalPadding: 10,
  scoreboardColumnGap: 10,
  scoreboardColorBarWidth: 4,
  scoreboardRankColumnX: 12,
  scoreboardPlayerColumnX: 38,
  scoreboardHeaderTextY: 7,
  scoreboardRowTextOffsetY: 6,
  scoreboardArmyColumnWidth: 54,
  scoreboardLandColumnWidth: 48,
  scoreboardBorderRadius: 8,
  scoreboardRowBorderRadius: 6,
  scoreboardPlayerNameMaxLength: 16,

  // Scoreboard text
  scoreboardRankHeader: "#",
  scoreboardPlayerHeader: "Player",
  scoreboardArmyHeader: "Army",
  scoreboardLandHeader: "Land",
  scoreboardFontFamily: "Arial, sans-serif",
  scoreboardFontSize: 13,
  scoreboardHeaderFontSize: 12,
  scoreboardFontWeight: "bold",
  scoreboardHeaderFontWeight: "bold",

  // Scoreboard colors
  scoreboardBackground: 0x0d1117,
  scoreboardBackgroundAlpha: 0.78,
  scoreboardBorderColor: 0xffffff,
  scoreboardBorderAlpha: 0.16,
  scoreboardBorderWidth: 1,
  scoreboardTextColor: 0xffffff,
  scoreboardMutedTextColor: 0x8b949e,
  scoreboardHeaderTextColor: 0xc9d1d9,
  scoreboardCurrentPlayerBackground: 0xffffff,
  scoreboardCurrentPlayerBackgroundAlpha: 0.12,
  scoreboardActiveRowAlpha: 1,
  scoreboardEliminatedRowAlpha: 0.35,
  scoreboardDividerColor: 0xffffff,
  scoreboardDividerAlpha: 0.08,
  scoreboardDividerWidth: 1,
} as const;
