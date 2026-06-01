import { describe, expect, it } from "vitest";

import { ActionType } from "#/domain/action/action-type";
import type { MoveAction } from "#/domain/action/interfaces";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { BiohazardGame } from "#/domain/game/biohazard-game";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import { SquareGrid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";
import { TeamType } from "#/domain/team/team-type";

function createGrid(width = 3, height = 1): SquareGrid {
  const cells = Array.from({ length: height }, (_, y) =>
    Array.from(
      { length: width },
      (_, x) =>
        new Cell({
          coordinate: { x, y },
          terrain: Terrain.PLAIN,
        }),
    ),
  );
  return new SquareGrid(width, height, cells);
}

describe("BiohazardGame", () => {
  it("initializes with default options and starts game in preparation phase", () => {
    const grid = createGrid();
    const game = new BiohazardGame({ grid });

    expect(game.mode).toBe(GameMode.BIOHAZARD);
    expect(game.outbreakTick).toBe(120);
    expect(game.maxTicks).toBe(480);
    expect(game.zombieTroopMultiplier).toBe(2);
    expect(game.infectionPhase).toBe("PREPARATION");

    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);

    game.startGame();
    expect(game.status).toBe(GameStatus.PLAYING);
  });

  it("triggers outbreak precisely when tick + 1 reaches outbreakTick", () => {
    const grid = createGrid();
    const game = new BiohazardGame({ grid }, { outbreakTick: 5 });

    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    t1.addPlayer(p1);
    t2.addPlayer(p2);
    game.teams.set("t1", t1);
    game.teams.set("t2", t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // From tick 0 to tick 3
    for (let i = 0; i < 4; i++) {
      game.nextTick();
    }
    expect(game.tick).toBe(4);
    expect(game.infectionPhase).toBe("PREPARATION");

    // Tick goes from 4 to 5, which triggers outbreak since 4 + 1 === 5
    game.nextTick();
    expect(game.tick).toBe(5);
    expect(game.infectionPhase).toBe("OUTBREAK");

    // Verify team structures: one should be HUMAN team, the other ZOMBIE team
    expect(game.teams.has("humans")).toBe(true);
    expect(game.teams.has("zombies")).toBe(true);

    const zombieTeam = game.teams.get("zombies");
    const humanTeam = game.teams.get("humans");

    expect(zombieTeam?.players.length).toBe(1);
    expect(humanTeam?.players.length).toBe(1);

    // Verify mother zombie IDs contain the chosen zombie player
    const zombiePlayer = zombieTeam?.players[0];
    expect(zombiePlayer).toBeDefined();
    if (zombiePlayer) {
      expect(game.motherZombiePlayerIds.has(zombiePlayer.playerId)).toBe(true);
    }
  });

  it("handles general capture and infection correctly during outbreak", () => {
    const grid = createGrid(3, 1);
    const game = new BiohazardGame({ grid }, { outbreakTick: 2 });

    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    t1.addPlayer(p1);
    t2.addPlayer(p2);
    game.teams.set("t1", t1);
    game.teams.set("t2", t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const cell0 = grid.get({ x: 0, y: 0 });
    const cell1 = grid.get({ x: 1, y: 0 });
    const cell2 = grid.get({ x: 2, y: 0 });
    if (!cell0 || !cell1 || !cell2) {
      throw new Error("Cells must exist");
    }

    game.startGame();

    cell0.owner = p1;
    cell0.troopCount = 10;
    cell1.owner = p2;
    cell1.terrain = Terrain.GENERAL;
    cell1.troopCount = 2;
    cell2.owner = p2;
    cell2.troopCount = 5;

    // Trigger Outbreak (tick goes from 0 to 1, then 1 to 2)
    game.nextTick();
    game.nextTick();
    expect(game.infectionPhase).toBe("OUTBREAK");

    // Force p1 to be Zombie and p2 to be Human
    const zombieTeam = game.teams.get("zombies");
    const humanTeam = game.teams.get("humans");
    if (!zombieTeam || !humanTeam) {
      throw new Error("Teams must exist");
    }

    t1.removePlayer(p1);
    t2.removePlayer(p2);

    p1.team = zombieTeam;
    zombieTeam.addPlayer(p1);
    game.motherZombiePlayerIds.add(p1.playerId);

    p2.team = humanTeam;
    humanTeam.addPlayer(p2);

    // Zombie p1 attacks Human p2's General (cell1)
    const action: MoveAction = {
      playerId: "p1",
      type: ActionType.MOVE,
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
    };

    const success = game.handleAction(action);
    expect(success).toBe(true);

    // Infection check:
    // General remains owned by p2 (the human converted to zombie)
    expect(cell1.owner).toBe(p2);
    expect(cell1.terrain).toBe(Terrain.GENERAL);
    expect(p2.team.type).toBe(TeamType.ZOMBIE); // Converted to zombie

    // Non-general cell2 of infected player is neutralized
    expect(cell2.owner).toBeNull();
  });

  describe("Win/Loss Evaluation", () => {
    it("handles preparation phase standard team elimination", () => {
      const grid = createGrid();
      const game = new BiohazardGame({ grid }, { outbreakTick: 5 });

      const t1 = new StandardTeam("t1");
      const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
      t1.addPlayer(p1);
      game.players.set(p1.playerId, p1);

      game.startGame();
      const endState = game.checkGameEnd();

      expect(endState).toEqual({
        mode: GameMode.BIOHAZARD,
        winnerTeamId: "t1",
      });
      expect(game.status).toBe(GameStatus.FINISHED);
    });

    it("handles zombie victory when no active humans remain", () => {
      const grid = createGrid();
      const game = new BiohazardGame({ grid }, { outbreakTick: 1 });

      const t1 = new StandardTeam("t1");
      const t2 = new StandardTeam("t2");
      const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
      const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
      t1.addPlayer(p1);
      t2.addPlayer(p2);
      game.teams.set("t1", t1);
      game.teams.set("t2", t2);
      game.players.set(p1.playerId, p1);
      game.players.set(p2.playerId, p2);

      game.startGame();
      game.nextTick(); // tick 1: outbreak triggers

      const zombieTeam = game.teams.get("zombies");
      const humanTeam = game.teams.get("humans");
      if (!zombieTeam || !humanTeam) {
        throw new Error("Teams must exist");
      }

      p1.team.removePlayer(p1);
      p2.team.removePlayer(p2);

      p1.team = zombieTeam;
      zombieTeam.addPlayer(p1);
      p2.team = humanTeam;
      humanTeam.addPlayer(p2);

      p2.status = PlayerStatus.ELIMINATED;

      const result = game.checkGameEnd();
      expect(result).toEqual({
        mode: GameMode.BIOHAZARD,
        winnerTeamId: "zombies",
      });
    });

    it("handles human victory when no active zombies remain", () => {
      const grid = createGrid();
      const game = new BiohazardGame({ grid }, { outbreakTick: 1 });

      const t1 = new StandardTeam("t1");
      const t2 = new StandardTeam("t2");
      const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
      const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
      t1.addPlayer(p1);
      t2.addPlayer(p2);
      game.teams.set("t1", t1);
      game.teams.set("t2", t2);
      game.players.set(p1.playerId, p1);
      game.players.set(p2.playerId, p2);

      game.startGame();
      game.nextTick(); // outbreak triggers

      const zombieTeam = game.teams.get("zombies");
      const humanTeam = game.teams.get("humans");
      if (!zombieTeam || !humanTeam) {
        throw new Error("Teams must exist");
      }

      p1.team.removePlayer(p1);
      p2.team.removePlayer(p2);

      p1.team = zombieTeam;
      zombieTeam.addPlayer(p1);
      p2.team = humanTeam;
      humanTeam.addPlayer(p2);

      p1.status = PlayerStatus.ELIMINATED;

      const result = game.checkGameEnd();
      expect(result).toEqual({
        mode: GameMode.BIOHAZARD,
        winnerTeamId: "humans",
      });
    });

    it("handles human victory when max ticks reached", () => {
      const grid = createGrid();
      const game = new BiohazardGame(
        { grid },
        { outbreakTick: 2, finishTick: 5 },
      );

      const t1 = new StandardTeam("t1");
      const t2 = new StandardTeam("t2");
      const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
      const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
      t1.addPlayer(p1);
      t2.addPlayer(p2);
      game.players.set(p1.playerId, p1);
      game.players.set(p2.playerId, p2);

      game.startGame();
      // Tick goes to 2 (outbreak)
      game.nextTick();
      game.nextTick();

      // Force one player zombie and one human
      const zombieTeam = game.teams.get("zombies");
      const humanTeam = game.teams.get("humans");
      if (!zombieTeam || !humanTeam) {
        throw new Error("Teams must exist");
      }
      p1.team = zombieTeam;
      p2.team = humanTeam;
      zombieTeam.addPlayer(p1);
      humanTeam.addPlayer(p2);

      // Tick goes to 5 (maxTicks)
      game.nextTick();
      game.nextTick();
      game.nextTick();

      const result = game.checkGameEnd();
      expect(result).toEqual({
        mode: GameMode.BIOHAZARD,
        winnerTeamId: "humans",
      });
      expect(game.status).toBe(GameStatus.FINISHED);
    });
  });

  describe("Scoreboard Output", () => {
    it("returns correct scoreboard details under biohazard mode", () => {
      const grid = createGrid();
      const game = new BiohazardGame({ grid }, { outbreakTick: 2 });

      const t1 = new StandardTeam("t1");
      const t2 = new StandardTeam("t2");
      const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
      const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
      t1.addPlayer(p1);
      t2.addPlayer(p2);
      game.teams.set("t1", t1);
      game.teams.set("t2", t2);
      game.players.set(p1.playerId, p1);
      game.players.set(p2.playerId, p2);

      game.startGame();

      const startCell = grid.get({ x: 0, y: 0 });
      if (!startCell) {
        throw new Error("Start cell must exist");
      }
      startCell.owner = p1;
      startCell.troopCount = 10;

      game.nextTick();
      game.nextTick(); // OUTBREAK

      const zombieTeam = game.teams.get("zombies");
      const humanTeam = game.teams.get("humans");
      if (!zombieTeam || !humanTeam) {
        throw new Error("Teams must exist");
      }

      p1.team.removePlayer(p1);
      p2.team.removePlayer(p2);

      p1.team = zombieTeam;
      zombieTeam.addPlayer(p1);
      game.motherZombiePlayerIds.add(p1.playerId);

      p2.team = humanTeam;
      humanTeam.addPlayer(p2);

      const scoreboard = game.getScoreboard();

      expect(scoreboard.mode).toBe(GameMode.BIOHAZARD);
      expect(scoreboard.infectionPhase).toBe("OUTBREAK");
      expect(scoreboard.zombieCount).toBe(1);
      expect(scoreboard.humanCount).toBe(1);

      const playerEntry = scoreboard.players.find((p) => p.playerId === "p1");
      expect(playerEntry).toBeDefined();
      if (playerEntry) {
        expect(playerEntry.isZombie).toBe(true);
        expect(playerEntry.isMotherZombie).toBe(true);
        expect(playerEntry.troops).toBe(10);
      }
    });
  });
});
