import { describe, expect, it } from "vitest";

import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import { PayloadGame } from "#/domain/game/payload-game";
import type { Grid } from "#/domain/grid/grid";
import { SquareGrid } from "#/domain/grid/grid";
import { SquareGridGenerator } from "#/domain/grid/grid-generator/square";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";

function create3x3GridWithTrack(): Grid {
  const grid = new SquareGrid(7, 3, [
    [
      new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 2, y: 0 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 3, y: 0 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 4, y: 0 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 5, y: 0 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 6, y: 0 }, terrain: Terrain.PLAIN }),
    ],
    [
      new Cell({ coordinate: { x: 0, y: 1 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 1, y: 1 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 2, y: 1 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 3, y: 1 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 4, y: 1 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 5, y: 1 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 6, y: 1 }, terrain: Terrain.PLAIN }),
    ],
    [
      new Cell({ coordinate: { x: 0, y: 2 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 1, y: 2 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 2, y: 2 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 3, y: 2 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 4, y: 2 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 5, y: 2 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 6, y: 2 }, terrain: Terrain.PLAIN }),
    ],
  ]);

  // Set the track coordinates (a straight center line horizontal track)
  grid.track = [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
    { x: 6, y: 1 },
  ];
  return grid;
}

describe("PayloadGame", () => {
  it("extracts track and sets initial cartIndex to the middle of the track", () => {
    const grid = create3x3GridWithTrack();
    const game = new PayloadGame({ grid });

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    expect(game.track.length).toBe(7);
    expect(game.cartIndex).toBe(3); // Math.floor(7 / 2)
    expect(game.payloadProgress).toBe(0.5);
  });

  it("calculates cart coordinates correctly based on cartSize", () => {
    const grid = create3x3GridWithTrack();
    const game = new PayloadGame({ grid }, { payloadCartSize: 3 });

    game.startGame();

    // Center is (3, 1), cart size is 3 (so dy in -1..1, dx in -1..1)
    const cartCoords = game.getCartCoordinates(game.cartIndex);
    expect(cartCoords.length).toBe(9);
    expect(cartCoords).toContainEqual({ x: 2, y: 0 });
    expect(cartCoords).toContainEqual({ x: 3, y: 1 });
    expect(cartCoords).toContainEqual({ x: 4, y: 2 });
  });

  it("advances the cart when a team meets the occupied tiles threshold and the other does not", () => {
    const grid = create3x3GridWithTrack();
    // required to occupy: 3
    const game = new PayloadGame(
      { grid },
      { payloadRequiredOccupied: 3, payloadCartSize: 3, payloadSpeed: 1 },
    );

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    // Setup mock positions of generals so game.startGame sets leftTeamId and rightTeamId correctly
    grid.get({ x: 0, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 0, y: 1 })!.owner = p1;
    grid.get({ x: 6, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 6, y: 1 })!.owner = p2;

    game.startGame();

    expect(game.leftTeamId).toBe("left-team");
    expect(game.rightTeamId).toBe("right-team");

    // Occupy 3 cells of the cart with left-team (p1)
    grid.get({ x: 2, y: 0 })!.owner = p1;
    grid.get({ x: 3, y: 0 })!.owner = p1;
    grid.get({ x: 4, y: 0 })!.owner = p1;

    // Evaluate push: Left team has 3/3, right team has 0. Left team pushes right (+1 index).
    // payloadSpeed = 1, so every 2 ticks it evaluates pushing
    game.nextTick();
    game.nextTick();

    expect(game.isContested).toBe(false);
    expect(game.cartIndex).toBe(4);
  });

  it("becomes contested when both sides meet pushing conditions or are present without pushing", () => {
    const grid = create3x3GridWithTrack();
    const game = new PayloadGame(
      { grid },
      { payloadRequiredOccupied: 2, payloadCartSize: 3, payloadSpeed: 1 },
    );

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    grid.get({ x: 0, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 0, y: 1 })!.owner = p1;
    grid.get({ x: 6, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 6, y: 1 })!.owner = p2;

    game.startGame();

    // Left team owns 2 cells, Right team owns 2 cells
    grid.get({ x: 2, y: 0 })!.owner = p1;
    grid.get({ x: 3, y: 0 })!.owner = p1;
    grid.get({ x: 2, y: 2 })!.owner = p2;
    grid.get({ x: 3, y: 2 })!.owner = p2;

    game.nextTick();
    game.nextTick();

    expect(game.isContested).toBe(true);
    expect(game.cartIndex).toBe(3); // remains same
  });

  it("shifts cart tiles: leaves 1 troop behind, friendly merges, and resolves enemy combats", () => {
    const grid = create3x3GridWithTrack();
    const game = new PayloadGame(
      { grid },
      { payloadRequiredOccupied: 2, payloadCartSize: 3, payloadSpeed: 1 },
    );

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    grid.get({ x: 0, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 0, y: 1 })!.owner = p1;
    grid.get({ x: 6, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 6, y: 1 })!.owner = p2;

    game.startGame();

    // Left team pushes: occupies 2 cells of the cart
    const c1 = grid.get({ x: 2, y: 1 })!;
    c1.owner = p1;
    c1.troopCount = 10;

    const c2 = grid.get({ x: 3, y: 1 })!;
    c2.owner = p1;
    c2.troopCount = 20;

    // Friendly destination: (4, 1) has same owner p1 with 5 troops
    const cFriendlyDest = grid.get({ x: 4, y: 1 })!;
    cFriendlyDest.owner = p1;
    cFriendlyDest.troopCount = 5;

    // Enemy destination: (5, 1) has enemy p2 with 3 troops
    const cEnemyDest = grid.get({ x: 5, y: 1 })!;
    cEnemyDest.owner = p2;
    cEnemyDest.troopCount = 3;

    // Shift cart right (dx = 1, dy = 0)
    // Moving tiles:
    // (2, 1) owner p1 (10 troops) -> leaves 1 troop at (2, 1). Shifts 9 troops to (3, 1).
    // (3, 1) owner p1 (20 troops) -> leaves 1 troop at (3, 1). Shifts 19 troops to (4, 1).
    // (4, 1) owner p1 (5 troops) -> shifts 4 troops to (5, 1).
    // Combat merges/combats:
    // (3, 1) receives 9 troops from (2, 1). Note that its original state was wiped to 1 troop by the vacated rule, so it ends up with 1 + 9 = 10 troops (owner p1).
    // (4, 1) receives 19 troops from (3, 1) onto its vacated 1 troop. It ends up with 1 + 19 = 20 troops (owner p1).
    // (5, 1) has enemy defender p2 with 3 troops. It receives 4 moving troops from (4, 1).
    // 4 troops > 3 troops -> Capture! New owner is p1 with 4 - 3 = 1 troop.

    game.nextTick();
    game.nextTick();

    expect(game.cartIndex).toBe(4);

    expect(grid.get({ x: 2, y: 1 })?.troopCount).toBe(1);
    expect(grid.get({ x: 2, y: 1 })?.owner).toBe(p1);

    expect(grid.get({ x: 3, y: 1 })?.troopCount).toBe(10);
    expect(grid.get({ x: 3, y: 1 })?.owner).toBe(p1);

    expect(grid.get({ x: 4, y: 1 })?.troopCount).toBe(20);
    expect(grid.get({ x: 4, y: 1 })?.owner).toBe(p1);

    expect(grid.get({ x: 5, y: 1 })?.troopCount).toBe(1);
    expect(grid.get({ x: 5, y: 1 })?.owner).toBe(p1);
  });

  it("wins immediately when a team pushes the cart to the opponent base end of the track", () => {
    const grid = create3x3GridWithTrack();
    const game = new PayloadGame(
      { grid },
      { payloadRequiredOccupied: 2, payloadCartSize: 3, payloadSpeed: 1 },
    );

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    grid.get({ x: 0, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 0, y: 1 })!.owner = p1;
    grid.get({ x: 6, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 6, y: 1 })!.owner = p2;

    game.startGame();

    // Manually place cart index at the penultimate spot (5)
    game.cartIndex = 5;

    // Occupy 2 cells of the cart with left-team to trigger the last push
    grid.get({ x: 4, y: 0 })!.owner = p1;
    grid.get({ x: 5, y: 0 })!.owner = p1;

    game.nextTick();
    game.nextTick();

    expect(game.cartIndex).toBe(6);
    expect(game.status).toBe(GameStatus.FINISHED);
    expect(game.checkGameEnd()).toEqual({
      mode: GameMode.PAYLOAD,
      winnerTeamId: "left-team",
    });
  });

  it("ends in a win for the team closer to their target when timeout ticks are reached", () => {
    const grid = create3x3GridWithTrack();
    const game = new PayloadGame({ grid }, { finishTick: 3 });

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    grid.get({ x: 0, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 0, y: 1 })!.owner = p1;
    grid.get({ x: 6, y: 1 })!.terrain = Terrain.GENERAL;
    grid.get({ x: 6, y: 1 })!.owner = p2;

    game.startGame();

    // Manually push cart index towards right-team base (e.g. index 4, which is > center 3)
    game.cartIndex = 4;

    game.nextTick();
    game.nextTick();
    game.nextTick(); // tick 3 reached!

    expect(game.status).toBe(GameStatus.FINISHED);
    expect(game.checkGameEnd()).toEqual({
      mode: GameMode.PAYLOAD,
      winnerTeamId: "left-team",
    });
  });

  it("protects the entire KxK cart path band from mountain and city generation", () => {
    const generator = new SquareGridGenerator();
    const grid = generator.generate({
      gridBounds: { width: 15, height: 11 },
      isPayload: true,
      payloadCartSize: 3,
      mountainRate: 0.35,
      cityRate: 0.08,
      generalCount: 2,
    });

    const cy = Math.floor(grid.height / 2);
    // Track goes from x = 3 to x = grid.width - 4. Cart covers x from 3 - 1 = 2 to 11 + 1 = 12.
    const startX = 3;
    const endX = grid.width - 4;
    const K = 3;
    const startOffset = -Math.floor((K - 1) / 2);
    const endOffset = Math.floor(K / 2);

    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = startX + startOffset; x <= endX + endOffset; x++) {
        const cell = grid.get({ x, y })!;
        // The cells inside the horizontal path band must either be generals or plains (no mountains or cities)
        if (cell.terrain === Terrain.GENERAL) continue;
        expect(cell.terrain).toBe(Terrain.PLAIN);
      }
    }
  });
});
