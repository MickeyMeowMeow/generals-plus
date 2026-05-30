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
import type {
  ICollapseGame,
  ICollapseScoreboard,
} from "#/domain/game/interfaces";
import type { GridInput } from "#/domain/grid/grid-generator";
import { PlayerStatus } from "#/domain/player/player-status";
import { getSquaredDistance } from "#/math/coordinate";

export const CollapseShape = {
  CIRCLE: "circle",
  SQUARE: "square",
} as const;

export type CollapseShape = (typeof CollapseShape)[keyof typeof CollapseShape];

export interface CollapseGameOptions {
  startDelayTicks?: number;
  shrinkIntervalTicks?: number;
  collapseShape?: CollapseShape;
}

export class CollapseGame extends BaseGame implements ICollapseGame {
  readonly mode = GameMode.COLLAPSE;
  private readonly combatResolver = new StandardCombatResolver();

  // Settings
  private readonly startDelayTicks: number;
  private readonly shrinkIntervalTicks: number;
  private readonly collapseShape: CollapseShape;

  // Private Safe Zone Tracker
  private safeCircleCenterX: number = 0;
  private safeCircleCenterY: number = 0;
  private safeCircleRadius: number = 0;

  private nextSafeCircleCenterX: number = 0;
  private nextSafeCircleCenterY: number = 0;
  private nextSafeCircleRadius: number = 0;

  private nextCollapseTick: number;
  private currentProgress: number = 0;

  private shrinkStep: number = 0;

  constructor(input: GridInput, options?: CollapseGameOptions) {
    super(input);
    this.startDelayTicks = options?.startDelayTicks ?? 120; // 60s at 2 ticks/s
    this.shrinkIntervalTicks = options?.shrinkIntervalTicks ?? 60; // 30s at 2 ticks/s
    this.collapseShape = options?.collapseShape ?? CollapseShape.CIRCLE;
    this.nextCollapseTick = this.startDelayTicks;
  }

  startGame(): void {
    super.startGame();
    this.assignStartPositions();

    // Troop generation periodic effects matching standard FFA
    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "collapse-general-troop-gen",
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
        id: "collapse-city-troop-gen",
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
        id: "collapse-plain-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 1,
        interval: 25,
      }),
    );

    // Initialize Safe Circle parameters
    const center = this.grid.cartesianCenter;
    this.safeCircleCenterX = center.x;
    this.safeCircleCenterY = center.y;

    // Calculate initial radius to cover the entire grid
    let maxSquaredDist = 0;
    this.grid.forEach((cell) => {
      const pos = this.grid.toCartesian(cell.coordinate);
      const d = getSquaredDistance(pos, center);
      if (d > maxSquaredDist) {
        maxSquaredDist = d;
      }
    });

    const maxDist = Math.sqrt(maxSquaredDist);

    this.safeCircleRadius = maxDist + 1.0; // padding to cover fully
    this.shrinkStep = maxDist / 6; // shrink in 6 stages

    // Pre-calculate the first NEXT safe circle and mark upcoming collapse cells
    this.calculateNextSafeZone();
  }

  protected executeAction(action: Action): boolean {
    if (
      action.type !== ActionType.MOVE &&
      action.type !== ActionType.SPLIT_MOVE
    ) {
      return false;
    }
    const success = this.combatResolver.execute(
      action,
      this.grid,
      this.players,
    );

    if (success) {
      this.checkGameEnd();
    }

    return success;
  }

  nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    // Process periodic effects
    super.nextTick();

    // Calculate current progress
    if (this.tick < this.startDelayTicks) {
      this.currentProgress = this.tick / this.startDelayTicks;
    } else {
      const elapsed =
        (this.tick - this.startDelayTicks) % this.shrinkIntervalTicks;
      this.currentProgress = elapsed / this.shrinkIntervalTicks;
    }

    // Apply Collapse
    if (this.tick === this.nextCollapseTick) {
      this.applyCollapse();
    }

    // Check game end
    this.checkGameEnd();
  }

  private applyCollapse(): void {
    // 1. Move safe circle to the pre-calculated next parameters
    this.safeCircleCenterX = this.nextSafeCircleCenterX;
    this.safeCircleCenterY = this.nextSafeCircleCenterY;
    this.safeCircleRadius = this.nextSafeCircleRadius;

    // 2. Devour all cells outside the safe circle
    const generalsDevoured: Array<{ cell: ICell; ownerId: string }> = [];

    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.VOID) return;

      const pos = this.grid.toCartesian(cell.coordinate);
      if (
        !this.isInsideSafeZone(
          pos,
          this.safeCircleCenterX,
          this.safeCircleCenterY,
          this.safeCircleRadius,
        )
      ) {
        const wasGeneral = cell.terrain === Terrain.GENERAL;
        const ownerId = cell.owner?.playerId;

        // Devour it into VOID (sets owner/troopCount to null, isPassable = false)
        cell.terrain = Terrain.VOID;

        if (wasGeneral && ownerId) {
          generalsDevoured.push({ cell, ownerId });
        }
      }
    });

    // 3. Relocate devoured generals
    for (const { ownerId } of generalsDevoured) {
      this.relocateGeneral(ownerId);
    }

    // 4. Calculate the next safe zone for upcoming tick collapses
    this.calculateNextSafeZone();

    // 5. Update collapse tick
    this.nextCollapseTick += this.shrinkIntervalTicks;
  }

  private isInsideSafeZone(
    pos: { x: number; y: number },
    cx: number,
    cy: number,
    r: number,
  ): boolean {
    if (this.collapseShape === "circle") {
      const d = Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2);
      return d <= r;
    } else {
      // Square/Rectangle shape based on the initial aspect ratio (derived from radius boundary box)
      // Represent width and height as 2 * radius
      return Math.abs(pos.x - cx) <= r && Math.abs(pos.y - cy) <= r;
    }
  }

  private calculateNextSafeZone(): void {
    // R_next = max(1.5, R_curr - shrinkStep)
    const nextRadius = Math.max(1.5, this.safeCircleRadius - this.shrinkStep);
    const maxOffset = this.safeCircleRadius - nextRadius;

    if (this.collapseShape === "circle") {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * maxOffset;
      this.nextSafeCircleCenterX =
        this.safeCircleCenterX + Math.cos(angle) * distance;
      this.nextSafeCircleCenterY =
        this.safeCircleCenterY + Math.sin(angle) * distance;
    } else {
      // Pick random X and Y offsets independently within the bounds of containment
      const dx = (Math.random() * 2 - 1) * maxOffset;
      const dy = (Math.random() * 2 - 1) * maxOffset;
      this.nextSafeCircleCenterX = this.safeCircleCenterX + dx;
      this.nextSafeCircleCenterY = this.safeCircleCenterY + dy;
    }
    this.nextSafeCircleRadius = nextRadius;

    // Reset willCollapse flags, and update cells that are outside the upcoming next safe circle
    this.grid.forEach((cell) => {
      cell.willCollapse = false;
      if (cell.terrain === Terrain.VOID) return;

      const pos = this.grid.toCartesian(cell.coordinate);
      if (
        !this.isInsideSafeZone(
          pos,
          this.nextSafeCircleCenterX,
          this.nextSafeCircleCenterY,
          this.nextSafeCircleRadius,
        )
      ) {
        cell.willCollapse = true;
      }
    });
  }

  private relocateGeneral(playerId: string): void {
    const candidates: ICell[] = [];

    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.VOID) return;
      if (cell.owner?.playerId !== playerId) return;

      const pos = this.grid.toCartesian(cell.coordinate);
      if (
        this.isInsideSafeZone(
          pos,
          this.safeCircleCenterX,
          this.safeCircleCenterY,
          this.safeCircleRadius,
        )
      ) {
        candidates.push(cell);
      }
    });

    if (candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const targetCell = candidates[randomIndex];
      targetCell.terrain = Terrain.GENERAL;
    } else {
      this.eliminatePlayer(playerId);
    }
  }

  private eliminatePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.status === PlayerStatus.ELIMINATED) return;

    player.status = PlayerStatus.ELIMINATED;
    this.grid.forEach((cell) => {
      if (cell.owner?.playerId === playerId) {
        cell.owner = null;
        this.onCellNeutralized(cell);
      }
    });
  }

  protected onCellNeutralized(cell: ICell): void {
    if (cell.terrain === Terrain.GENERAL) {
      cell.terrain = Terrain.CITY;
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

    return null;
  }

  getScoreboard(): ICollapseScoreboard {
    const baseScores = this.calculateBaseScores();
    const generals = new Set<string>();

    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.GENERAL && cell.owner) {
        generals.add(cell.owner.playerId);
      }
    });

    const players = Array.from(baseScores.entries()).map(
      ([playerId, score]) => ({
        playerId,
        troops: score.troops,
        land: score.land,
        isAlive: generals.has(playerId),
      }),
    );

    return {
      mode: this.mode,
      players,
      nextCollapseTick: this.nextCollapseTick,
      currentProgress: this.currentProgress,
      startDelayTicks: this.startDelayTicks,
      shrinkIntervalTicks: this.shrinkIntervalTicks,
    };
  }
}
