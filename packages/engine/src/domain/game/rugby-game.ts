import { ActionType } from "#/domain/action/action-type";
import type { Action } from "#/domain/action/interfaces";
import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { StandardCombatResolver } from "#/domain/combat/standard-combat-resolver";
import { EffectType } from "#/domain/effect/effect-type";
import { TroopModifierEffect } from "#/domain/effect/periodic/troop-modifier";
import { BaseGame } from "#/domain/game/base-game";
import { GameMode } from "#/domain/game/game-mode";
import type { IGameResult } from "#/domain/game/game-result";
import { GameStatus } from "#/domain/game/game-status";
import type { IRugbyGame, IRugbyScoreboard } from "#/domain/game/interfaces";
import type { GridInput } from "#/domain/grid/grid-generator";
import type { IItem } from "#/domain/item/interfaces";
import { GameItem } from "#/domain/item/item";
import { ItemType } from "#/domain/item/item-type";
import type { IPlayer } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";

export interface RugbyGameOptions {
  finishTick?: number;
  rugbyBallCount?: number;
  rugbyMoveSpeedTicks?: number;
  rugbyWinningScore?: number;
}

export class RugbyGame extends BaseGame implements IRugbyGame {
  readonly mode = GameMode.RUGBY;
  private readonly combatResolver = new StandardCombatResolver();

  readonly rugbyBallCount: number;
  readonly rugbyMoveSpeedTicks: number;
  readonly winningScore: number;
  readonly maxTicks: number;

  balls: IItem[] = [];
  teamScores: Map<string, number> = new Map();
  lastBallMoveTickMap: Map<string, number> = new Map();

  leftTeamId: string | null = null;
  rightTeamId: string | null = null;

  constructor(input: GridInput, options?: RugbyGameOptions) {
    super(input);
    this.maxTicks = options?.finishTick ?? 360;
    this.rugbyBallCount = options?.rugbyBallCount ?? 1;
    this.rugbyMoveSpeedTicks = options?.rugbyMoveSpeedTicks ?? 2;
    this.winningScore = options?.rugbyWinningScore ?? 5;
  }

  protected assignStartPositions(
    targetTerrain: Terrain = Terrain.GENERAL,
  ): void {
    if (this.spawnPositions) {
      super.assignStartPositions(targetTerrain);
      return;
    }

    const generalCells: ICell[] = [];
    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.GENERAL) {
        generalCells.push(cell);
      }
    });

    // Find the average X coordinate of all generals
    let sumX = 0;
    for (const cell of generalCells) {
      sumX += cell.coordinate.x;
    }
    const midX = generalCells.length > 0 ? sumX / generalCells.length : 0;

    const leftGenerals = generalCells.filter(
      (cell) => cell.coordinate.x < midX,
    );
    const rightGenerals = generalCells.filter(
      (cell) => cell.coordinate.x >= midX,
    );

    const teamIds = Array.from(this.teams.keys()).sort();
    const teamALeft = teamIds[0] ?? "";
    const teamBRight = teamIds[1] ?? "";

    const playersA = Array.from(this.players.values()).filter(
      (p) => p.team.teamId === teamALeft,
    );
    const playersB = Array.from(this.players.values()).filter(
      (p) => p.team.teamId === teamBRight,
    );

    let idxA = 0;
    for (const cell of leftGenerals) {
      if (idxA < playersA.length) {
        cell.terrain = targetTerrain;
        cell.owner = playersA[idxA];
        idxA++;
      } else {
        cell.terrain = Terrain.PLAIN; // Convert unused general to neutral plain
        cell.owner = null;
        cell.troopCount = null;
      }
    }

    let idxB = 0;
    for (const cell of rightGenerals) {
      if (idxB < playersB.length) {
        cell.terrain = targetTerrain;
        cell.owner = playersB[idxB];
        idxB++;
      } else {
        cell.terrain = Terrain.PLAIN; // Convert unused general to neutral plain
        cell.owner = null;
        cell.troopCount = null;
      }
    }
  }

  startGame(): void {
    super.startGame();
    this.assignStartPositions(Terrain.GENERAL);

    // Identify left and right teams based on average start positions of their generals
    const teamAverageX = new Map<string, number>();
    for (const team of this.teams.values()) {
      let sumX = 0;
      let count = 0;
      this.grid.forEach((cell) => {
        if (
          cell.terrain === Terrain.GENERAL &&
          cell.owner &&
          (cell.owner as IPlayer).team.teamId === team.teamId
        ) {
          sumX += cell.coordinate.x;
          count++;
        }
      });
      if (count > 0) {
        teamAverageX.set(team.teamId, sumX / count);
      }
    }

    const sortedTeams = Array.from(teamAverageX.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([teamId]) => teamId);

    this.leftTeamId = sortedTeams[0] ?? null;
    this.rightTeamId = sortedTeams[1] ?? null;

    if (this.leftTeamId) this.teamScores.set(this.leftTeamId, 0);
    if (this.rightTeamId) this.teamScores.set(this.rightTeamId, 0);

    // Spawn rugby balls
    const spawnCells: ICell[] = [];
    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.RUGBY_SPAWN && !cell.item) {
        spawnCells.push(cell);
      }
    });

    const count = this.rugbyBallCount;
    for (let i = 0; i < count; i++) {
      let targetCell: ICell | null = null;
      if (spawnCells.length > 0) {
        const idx = Math.floor(Math.random() * spawnCells.length);
        targetCell = spawnCells[idx];
        spawnCells.splice(idx, 1); // remove to prevent multiple balls spawning on same cell
      } else {
        const candidates: ICell[] = [];
        this.grid.forEach((cell) => {
          if (cell.terrain === Terrain.PLAIN && !cell.item) {
            candidates.push(cell);
          }
        });
        candidates.sort(
          (a, b) =>
            this.grid.getDistanceToCenter(a.coordinate) -
            this.grid.getDistanceToCenter(b.coordinate),
        );
        if (candidates.length > 0) {
          targetCell = candidates[0];
        }
      }

      if (targetCell) {
        const ball = new GameItem(
          ItemType.RUGBY_BALL,
          `rugby_ball_${i}`,
          targetCell.coordinate,
        );
        targetCell.item = ball;
        this.balls.push(ball);
      }
    }

    // Register troop growth effects
    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "rugby-general-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.GENERAL,
        delta: 1,
        interval: 1,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "rugby-city-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.CITY,
        delta: 1,
        interval: 1,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "rugby-plain-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 1,
        interval: 25,
      }),
    );
  }

  protected executeAction(action: Action): boolean {
    if (
      action.type !== ActionType.MOVE &&
      action.type !== ActionType.SPLIT_MOVE
    ) {
      return false;
    }

    const source = this.grid.get(action.from);
    if (!source) return false;

    // Ball movement speed delay logic
    const ball = source.item;
    if (ball && ball.type === ItemType.RUGBY_BALL) {
      const lastMoveTick = this.lastBallMoveTickMap.get(ball.id) ?? -1;
      if (
        lastMoveTick >= 0 &&
        this.tick - lastMoveTick < this.rugbyMoveSpeedTicks
      ) {
        // Under carrier move cooldown, reject action
        return false;
      }
    }

    const success = this.combatResolver.execute(
      action,
      this.grid,
      this.players,
    );

    if (success) {
      const target = this.grid.get(action.to);
      const movedBall = target?.item;
      if (movedBall && movedBall.type === ItemType.RUGBY_BALL) {
        this.lastBallMoveTickMap.set(movedBall.id, this.tick);
      }
      this.checkEliminations();
      this.checkScoring();
      this.checkGameEnd();
    }

    return success;
  }

  private checkEliminations(): void {
    for (const player of this.players.values()) {
      if (player.status !== PlayerStatus.ACTIVE) continue;

      let hasLand = false;
      this.grid.forEach((cell) => {
        if (cell.owner?.playerId === player.playerId) {
          hasLand = true;
        }
      });

      if (!hasLand) {
        this.handleSurrender(player.playerId);
      }
    }
  }

  nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    super.nextTick();

    this.checkScoring();
    this.checkGameEnd();
  }

  private checkScoring(): void {
    this.grid.forEach((cell) => {
      if (
        cell.terrain === Terrain.GOAL_ZONE &&
        cell.item &&
        cell.item.type === ItemType.RUGBY_BALL
      ) {
        const owner = cell.owner;
        if (owner) {
          const scoringPlayer = this.players.get(owner.playerId);
          if (scoringPlayer) {
            const scoringTeamId = scoringPlayer.team.teamId;

            // Left team (leftTeamId) scores in Right Goal (zoneIndex = 1)
            // Right team (rightTeamId) scores in Left Goal (zoneIndex = 0)
            const isLeftTeamScoring =
              cell.zoneIndex === 1 && scoringTeamId === this.leftTeamId;
            const isRightTeamScoring =
              cell.zoneIndex === 0 && scoringTeamId === this.rightTeamId;

            if (isLeftTeamScoring || isRightTeamScoring) {
              const currentScore = this.teamScores.get(scoringTeamId) ?? 0;
              this.teamScores.set(scoringTeamId, currentScore + 1);

              const ballId = cell.item.id;
              cell.item = null; // Remove the ball

              this.respawnBall(ballId);
            }
          }
        }
      }
    });
  }

  respawnBall(ballId: string): void {
    const spawnCells: ICell[] = [];
    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.RUGBY_SPAWN && !cell.item) {
        spawnCells.push(cell);
      }
    });

    let targetCell: ICell | null = null;
    if (spawnCells.length > 0) {
      const idx = Math.floor(Math.random() * spawnCells.length);
      targetCell = spawnCells[idx];
    } else {
      const candidates: ICell[] = [];
      this.grid.forEach((cell) => {
        if (cell.terrain === Terrain.PLAIN && !cell.item) {
          candidates.push(cell);
        }
      });
      candidates.sort(
        (a, b) =>
          this.grid.getDistanceToCenter(a.coordinate) -
          this.grid.getDistanceToCenter(b.coordinate),
      );
      if (candidates.length > 0) {
        targetCell = candidates[0];
      }
    }

    if (targetCell) {
      const ball = new GameItem(
        ItemType.RUGBY_BALL,
        ballId,
        targetCell.coordinate,
      );
      targetCell.item = ball;
      this.balls = this.balls.filter((b) => b.id !== ballId);
      this.balls.push(ball);
    }
  }

  protected evaluateGameEnd(): IGameResult | null {
    const aliveTeams = this.getAliveTeams();
    if (aliveTeams.size <= 1) {
      return {
        mode: this.mode,
        winnerTeamId: aliveTeams.values().next().value ?? null,
      };
    }

    if (this.leftTeamId) {
      const leftScore = this.teamScores.get(this.leftTeamId) ?? 0;
      if (leftScore >= this.winningScore) {
        return {
          mode: this.mode,
          winnerTeamId: this.leftTeamId,
        };
      }
    }

    if (this.rightTeamId) {
      const rightScore = this.teamScores.get(this.rightTeamId) ?? 0;
      if (rightScore >= this.winningScore) {
        return {
          mode: this.mode,
          winnerTeamId: this.rightTeamId,
        };
      }
    }

    if (this.tick >= this.maxTicks) {
      const leftScore = this.leftTeamId
        ? (this.teamScores.get(this.leftTeamId) ?? 0)
        : 0;
      const rightScore = this.rightTeamId
        ? (this.teamScores.get(this.rightTeamId) ?? 0)
        : 0;

      if (leftScore > rightScore) {
        return {
          mode: this.mode,
          winnerTeamId: this.leftTeamId,
        };
      }
      if (rightScore > leftScore) {
        return {
          mode: this.mode,
          winnerTeamId: this.rightTeamId,
        };
      }
      return {
        mode: this.mode,
        winnerTeamId: null,
      };
    }

    return null;
  }

  getScoreboard(): IRugbyScoreboard {
    const baseScores = this.calculateBaseScores();
    const players = Array.from(baseScores.entries()).map(
      ([playerId, score]) => {
        const player = this.players.get(playerId);
        return {
          playerId,
          troops: score.troops,
          land: score.land,
          isAlive: player?.status === PlayerStatus.ACTIVE,
        };
      },
    );

    return {
      mode: this.mode,
      players,
      teamScores: this.teamScores,
      winningScore: this.winningScore,
      totalTimeTicks: this.maxTicks,
      rugbyBallCount: this.rugbyBallCount,
      rugbyMoveSpeedTicks: this.rugbyMoveSpeedTicks,
    };
  }
}
