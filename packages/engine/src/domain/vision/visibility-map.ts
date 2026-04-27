import type { IGrid } from "#/domain/grid/interfaces";
import type { Team } from "#/domain/team/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { Visibility } from "#/domain/vision/visibility";
import { MaskedTerrain, type IVisionCell, type IVisionGrid } from "#/domain/vision/vision-grid";
import { Grid2D } from "#/math/grid-2d";

class VisionGrid extends Grid2D<IVisionCell> implements IVisionGrid {};

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
  public evaluate(team: Team): IVisionGrid {
    const width = this.gameGrid.width;
    const height = this.gameGrid.height;

    // Initialize all as HIDDEN
    const visibilityData: Visibility[][] = Array.from({ length: height }, () => 
      Array(width).fill(Visibility.HIDDEN)
    );

    this.gameGrid.forEach((cell, coord) => {
      if (cell.owner && team.players.some(p => p.playerId === cell.owner?.playerId)) {
        const radius = cell.vision?.radius ?? 1; // 1 means 3x3 square, 2 means 5x5 square

        // Mark all cells within Chebyshev distance <= radius as VISIBLE
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            // Using Chebyshev distance (square) instead of Manhattan
            if (Math.max(Math.abs(dx), Math.abs(dy)) <= radius) {
              const targetY = coord.y + dy;
              const targetX = coord.x + dx;
              
              if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
                visibilityData[targetY][targetX] = Visibility.VISIBLE;
              }
            }
          }
        }
      }
    });

    const gridData: (IVisionCell)[][] = Array.from({ length: height }, () => 
      Array(width).fill(
        {
          coordinate: { x: 0, y: 0 },
          visibility: Visibility.HIDDEN,
          terrain: null,
          troopCount: null,
          owner: null,
        }
      )
    );

    this.gameGrid.forEach((cell, coord) => {
      const visibility = visibilityData[coord.y][coord.x];
      let maskedTerrain = null;
      if (visibility === Visibility.HIDDEN || visibility === Visibility.SHROUDED) {
        maskedTerrain = (cell.terrain === Terrain.MOUNTAIN || cell.terrain === Terrain.CITY || cell.terrain === Terrain.GENERAL) 
          ? MaskedTerrain.MAYBE_MOUNTAIN 
          : MaskedTerrain.MAYBE_PLAIN;
      }

      gridData[coord.y][coord.x] = {
        coordinate: cell.coordinate,
        visibility,
        terrain: visibility === Visibility.VISIBLE ? cell.terrain : maskedTerrain,
        troopCount: visibility === Visibility.VISIBLE ? cell.troopCount : null,
        owner: visibility === Visibility.VISIBLE ? cell.owner : null,
      };
    });

    return new VisionGrid(width, height, gridData);
  }
}
