import { describe, expect, it, vi } from "vitest";

import type { ICellOwner } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { EffectTarget } from "#/domain/effect/effect-target";
import { EffectType } from "#/domain/effect/effect-type";
import { TroopModifierEffect } from "#/domain/effect/periodic/troop-modifier";
import { PlayerStatus } from "#/domain/player/player-status";
import type { ICoordinate } from "#/math/coordinate";

/**
 * Mock implementation of a cell that can carry troops.
 */
class MockCell {
  terrain: Terrain;
  owner: ICellOwner | null;
  troopCount = 0;

  constructor(terrain: Terrain, owner: ICellOwner | null, troopCount: number) {
    this.terrain = terrain;
    this.owner = owner;
    this.troopCount = troopCount;
  }

  addTroops(delta: number): void {
    this.troopCount += delta;
  }
}

/**
 * Mock implementation of the grid.
 */
class MockGrid extends EffectTarget {
  cells: MockCell[] = [];

  constructor() {
    super("main-grid");
  }

  /**
   * Helper to add cells.
   */
  addCell(terrain: Terrain, owner: ICellOwner | null): MockCell {
    const cell = new MockCell(terrain, owner, 0);
    this.cells.push(cell);
    return cell;
  }

  forEachTerrain(
    terrain: Terrain,
    callback: (cell: MockCell, coordinate: ICoordinate) => void,
  ): void {
    this.cells.forEach((cell) => {
      if (cell.terrain === terrain) {
        callback(cell, { x: 0, y: 0 });
      }
    });
  }

  // Dummy implementations for Grid2D
  width = 0;
  height = 0;
  get = vi.fn();
  getNeighbors = vi.fn();
  isValid = vi.fn();
  forEach = vi.fn();
}

describe("TroopModifierEffect", () => {
  it("should initialize with correct properties", () => {
    const grid = new MockGrid();
    const currentTick = 50;
    const interval = 10;

    const effect = new TroopModifierEffect(currentTick, {
      id: "gen-eff",
      type: EffectType.TROOP_GENERATION,
      target: grid,
      terrain: Terrain.PLAIN,
      delta: 1,
      interval: interval,
    });

    expect(effect.triggerAt).toBe(60); // 50 + 10
    expect(effect.terrain).toBe(Terrain.PLAIN);
  });

  it("should modify troops only on matching terrain with active players", () => {
    const grid = new MockGrid();

    // Matching terrain, active player -> should be affected
    const targetCell = grid.addCell(Terrain.CITY, {
      status: PlayerStatus.ACTIVE,
    });

    // Matching terrain, neutral cell -> should not be affected
    const neutralCell = grid.addCell(Terrain.CITY, null);

    // Matching terrain, eliminated player -> should not be affected
    const deadCell = grid.addCell(Terrain.CITY, {
      status: PlayerStatus.ELIMINATED,
    });

    // Different terrain, active player -> should not be affected
    const plainCell = grid.addCell(Terrain.PLAIN, {
      status: PlayerStatus.ACTIVE,
    });

    const effect = new TroopModifierEffect(0, {
      id: "city-gen",
      type: EffectType.TROOP_GENERATION,
      target: grid,
      terrain: Terrain.CITY,
      delta: 1,
      interval: 25,
    });

    // Execute trigger
    effect.trigger(25);

    expect(targetCell.troopCount).toBe(1);
    expect(neutralCell.troopCount).toBe(0);
    expect(deadCell.troopCount).toBe(0);
    expect(plainCell.troopCount).toBe(0);
  });

  it("should support negative deltas", () => {
    const grid = new MockGrid();
    const swampCell = grid.addCell(Terrain.SWAMP, {
      status: PlayerStatus.ACTIVE,
    });
    swampCell.troopCount = 5;

    const effect = new TroopModifierEffect(0, {
      id: "swamp-drain",
      type: EffectType.TROOP_DRAIN,
      target: grid,
      terrain: Terrain.SWAMP,
      delta: -3,
      interval: 1,
    });

    effect.trigger(1);

    expect(swampCell.troopCount).toBe(2);
  });

  it("should update triggerAt based on interval after triggering", () => {
    const grid = new MockGrid();
    const effect = new TroopModifierEffect(100, {
      id: "eff",
      type: EffectType.TROOP_GENERATION,
      target: grid,
      terrain: Terrain.PLAIN,
      delta: 1,
      interval: 50,
    });

    expect(effect.triggerAt).toBe(150);

    effect.trigger(150);

    expect(effect.triggerAt).toBe(200);
  });
});
