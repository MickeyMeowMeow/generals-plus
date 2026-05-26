import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import type { IGrid } from "#/domain/grid/interfaces";
import type { Team } from "#/domain/team/interfaces";
import { Visibility } from "#/domain/vision/visibility";
import type { IVisionCell, IVisionGrid } from "#/domain/vision/vision-grid";
import { HiddenTerrain, MaskedTerrain } from "#/domain/vision/vision-grid";
import type { GenericGrid2D } from "#/math/grid-2d";

/**
 * Maps a real game cell to a perceived vision cell according to the provided visibility.
 */
export function createVisionCell(
  cell: ICell,
  visibility: Visibility,
): IVisionCell {
  switch (visibility) {
    case Visibility.VISIBLE:
      return {
        coordinate: cell.coordinate,
        visibility,
        terrain: cell.terrain,
        troopCount: cell.troopCount,
        owner: cell.owner,
      };
    case Visibility.TERRAIN:
      return {
        coordinate: cell.coordinate,
        visibility,
        terrain: cell.terrain,
        troopCount: null,
        owner: null,
      };
    case Visibility.SHROUDED:
      return {
        coordinate: cell.coordinate,
        visibility,
        terrain:
          cell.terrain === Terrain.MOUNTAIN || cell.terrain === Terrain.CITY
            ? MaskedTerrain.MAYBE_MOUNTAIN
            : MaskedTerrain.MAYBE_PLAIN,
        troopCount: null,
        owner: null,
      };
    case Visibility.HIDDEN:
      return {
        coordinate: cell.coordinate,
        visibility,
        terrain: HiddenTerrain,
        troopCount: null,
        owner: null,
      };
  }
}

export class VisibilityMap {
  private readonly gameGrid: IGrid;

  constructor(gameGrid: IGrid) {
    this.gameGrid = gameGrid;
  }

  /**
   * Evaluates the visibility of the entire grid for a specific team.
   * @param team The team to evaluate visibility for.
   * @returns An IVisionGrid representing the visibility of each cell.
   */
  evaluate(team: Team, all_visible = false): IVisionGrid {
    const teamPlayerIds = new Set(
      team.players.map((player) => player.playerId),
    );

    // Compute visibility for each cell based on ownership and terrain.
    // Start with all cells as SHROUDED (or VISIBLE if all_visible is true), then mark visible areas based on owned cells and flags.
    const visibilityData: GenericGrid2D<Visibility> = all_visible
      ? this.gameGrid.map(() => Visibility.VISIBLE)
      : this.gameGrid.map(() => Visibility.SHROUDED);

    this.gameGrid.forEach((cell, coord) => {
      if (
        (cell.owner && teamPlayerIds.has(cell.owner.playerId)) ||
        cell.terrain === Terrain.FLAG
      ) {
        const radius = cell.vision?.radius ?? 1; // 1 means 3x3 square, 2 means 5x5 square

        // Mark all cells within Chebyshev distance <= radius as VISIBLE
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const current = { x: coord.x + dx, y: coord.y + dy };
            visibilityData.set(current, Visibility.VISIBLE);
          }
        }
      }
    });

    // Compute perceived terrain and metadata based on visibility.
    const visionGrid = this.gameGrid.map((cell, coord) => {
      const visibility = visibilityData.get(coord) ?? Visibility.SHROUDED;
      return createVisionCell(cell, visibility);
    });

    return visionGrid;
  }
}
