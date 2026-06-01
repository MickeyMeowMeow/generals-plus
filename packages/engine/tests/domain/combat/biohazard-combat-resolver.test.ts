import { describe, expect, it, vi } from "vitest";

import type { MoveActionType } from "#/domain/action/action-type";
import { ActionType } from "#/domain/action/action-type";
import type { MoveAction } from "#/domain/action/interfaces";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { BiohazardCombatResolver } from "#/domain/combat/biohazard-combat-resolver";
import { SquareGrid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { HumanTeam, StandardTeam, ZombieTeam } from "#/domain/team/team";

function createMoveAction(type: MoveActionType = ActionType.MOVE): MoveAction {
  return {
    playerId: "p1",
    type,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
  };
}

describe("BiohazardCombatResolver", () => {
  it("performs standard elimination when a human captures another general (or pre-outbreak FFA)", () => {
    const resolver = new BiohazardCombatResolver();
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1");
    const p2 = new Player(t2, "p2");
    const players = new Map([
      ["p1", p1],
      ["p2", p2],
    ]);

    const grid = new SquareGrid(3, 1, [
      [
        new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.PLAIN }),
        new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.GENERAL }),
        new Cell({ coordinate: { x: 2, y: 0 }, terrain: Terrain.PLAIN }),
      ],
    ]);

    const source = grid.get({ x: 0, y: 0 });
    const general = grid.get({ x: 1, y: 0 });
    const otherCell = grid.get({ x: 2, y: 0 });
    if (!source || !general || !otherCell) {
      throw new Error("cells should exist");
    }

    source.owner = p1;
    source.troopCount = 10;
    general.owner = p2;
    general.troopCount = 3;
    otherCell.owner = p2;
    otherCell.troopCount = 5;

    const onInfectionSpy = vi.fn();
    resolver.onInfection = onInfectionSpy;

    const result = resolver.execute(createMoveAction(), grid, players);

    expect(result).toBe(true);
    // General terrain changes to CITY, and captured player is eliminated.
    expect(general.terrain).toBe(Terrain.CITY);
    expect(general.owner).toBe(p1);
    expect(general.troopCount).toBe(6); // 10 - 1 (stays) - 3 (defenders) = 6
    expect(otherCell.owner).toBe(p1); // Captured cells handed to attacker
    expect(p2.status).toBe(PlayerStatus.ELIMINATED);
    expect(onInfectionSpy).not.toHaveBeenCalled();
  });

  it("infects a human player and converts them to zombie when a zombie general capture occurs", () => {
    const resolver = new BiohazardCombatResolver();
    const t1 = new ZombieTeam("zombies");
    const t2 = new HumanTeam("humans");
    const p1 = new Player(t1, "p1"); // Zombie
    const p2 = new Player(t2, "p2"); // Human
    const players = new Map([
      ["p1", p1],
      ["p2", p2],
    ]);

    const grid = new SquareGrid(3, 1, [
      [
        new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.PLAIN }),
        new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.GENERAL }),
        new Cell({ coordinate: { x: 2, y: 0 }, terrain: Terrain.PLAIN }),
      ],
    ]);

    const source = grid.get({ x: 0, y: 0 });
    const general = grid.get({ x: 1, y: 0 });
    const otherCell = grid.get({ x: 2, y: 0 });
    if (!source || !general || !otherCell) {
      throw new Error("cells should exist");
    }

    source.owner = p1;
    source.troopCount = 10;
    general.owner = p2;
    general.troopCount = 3;
    otherCell.owner = p2;
    otherCell.troopCount = 5;

    const onInfectionSpy = vi.fn();
    resolver.onInfection = onInfectionSpy;

    const result = resolver.execute(createMoveAction(), grid, players);

    expect(result).toBe(true);

    // Infection: general owner remains targetPlayer so they stay as their base
    expect(general.terrain).toBe(Terrain.GENERAL);
    expect(general.owner).toBe(p2);
    // General troop count is neutralized/re-resolved standard base-combat logic?
    // Let's verify base-combat-resolver behavior. In BaseCombatResolver, it performs:
    // If target owner was general, onGeneralCaptured is called. In BiohazardCombatResolver:
    // target.owner = targetPlayer;
    // Let's see: target.owner is temporarily set to attacker inside execute, but onGeneralCaptured overrides it back to targetPlayer!
    // What is the troop count? Let's check how troop count is computed in BaseCombatResolver.
    // In standard BaseCombatResolver, troopCount on target is updated after/during capture.
    // Let's read BaseCombatResolver to check troop count calculations.
    expect(onInfectionSpy).toHaveBeenCalledWith("p2", "p1");
    expect(otherCell.owner).toBeNull(); // Other cells of infected player are neutralized (owner = null)
    expect(p2.status).toBe(PlayerStatus.ACTIVE); // Human is not eliminated, they convert to zombie
  });
});
