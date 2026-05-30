import { Terrain, Visibility } from "@generals-plus/engine";
import { describe, expect, it } from "vitest";

import { getCellFillColor } from "#/features/game/renderer/layers/grid";
import {
  NeutralTroopCellColor,
  TerrainTheme,
} from "#/features/game/renderer/theme";

describe("getCellFillColor", () => {
  it("uses a distinct color for neutral tiles with neutral troops", () => {
    const color = getCellFillColor(
      {
        coordinate: { x: 0, y: 0 },
        visibility: Visibility.VISIBLE,
        terrain: Terrain.PLAIN,
        troopCount: 5,
        ownerIndex: null,
        siteIndex: null,
        item: null,
      },
      new Map(),
    );

    expect(color).toBe(NeutralTroopCellColor);
  });

  it("keeps terrain color for neutral empty tiles", () => {
    const color = getCellFillColor(
      {
        coordinate: { x: 0, y: 0 },
        visibility: Visibility.VISIBLE,
        terrain: Terrain.PLAIN,
        troopCount: null,
        ownerIndex: null,
        siteIndex: null,
        item: null,
      },
      new Map(),
    );

    expect(color).toBe(TerrainTheme[Terrain.PLAIN].color);
  });
});
