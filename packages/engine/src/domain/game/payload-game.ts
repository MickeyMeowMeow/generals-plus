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
  IPayloadGame,
  IPayloadScoreboard,
} from "#/domain/game/interfaces";
import type { GridInput } from "#/domain/grid/grid-generator";
import type { IPlayer } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";

export interface PayloadGameOptions {
  finishTick?: number;
  payloadSpeed?: number;
  payloadCartSize?: number;
  payloadRequiredOccupied?: number;
}

export class PayloadGame extends BaseGame implements IPayloadGame {
  readonly mode = GameMode.PAYLOAD;
  private readonly combatResolver = new StandardCombatResolver();

  readonly payloadSpeed: number;
  readonly payloadCartSize: number;
  readonly payloadRequiredOccupied: number;
  readonly maxTicks: number;

  track: ICoordinate[] = [];
  cartIndex: number = 0;
  leftTeamId: string | null = null;
  rightTeamId: string | null = null;
  isContested: boolean = false;

  get payloadProgress(): number {
    if (this.track.length <= 1) return 0.5;
    return this.cartIndex / (this.track.length - 1);
  }

  constructor(input: GridInput, options?: PayloadGameOptions) {
    super(input);
    this.maxTicks = options?.finishTick ?? 600;
    this.payloadSpeed = options?.payloadSpeed ?? 2;
    this.payloadCartSize = options?.payloadCartSize ?? 3;
    this.payloadRequiredOccupied = options?.payloadRequiredOccupied ?? 6;
  }

  startGame(): void {
    super.startGame();
    this.assignStartPositions(Terrain.GENERAL);

    // Get track from grid
    this.track = this.grid.track;
    if (this.track.length === 0) {
      // Fallback: horizontal track in the center, away from edges/generals
      const cy = Math.floor(this.grid.height / 2);
      const track: ICoordinate[] = [];
      const startX = Math.min(3, Math.floor(this.grid.width / 2));
      const endX = Math.max(startX, this.grid.width - 1 - startX);
      for (let x = startX; x <= endX; x++) {
        track.push({ x, y: cy });
      }
      this.grid.track = track;
      this.track = track;
    }

    // Set initial cart center index in the middle of the track
    this.cartIndex = Math.floor(this.track.length / 2);

    // Identify left and right teams based on average start positions of their generals
    const teamAverageX = new Map<string, number>();
    for (const team of this.teams.values()) {
      let sumX = 0;
      let count = 0;
      this.grid.forEach((cell) => {
        if (
          cell.terrain === Terrain.GENERAL &&
          cell.owner &&
          cell.owner.team.teamId === team.teamId
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

    // Register troop growth effects
    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "payload-general-troop-gen",
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
        id: "payload-city-troop-gen",
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
        id: "payload-plain-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 1,
        interval: 25,
      }),
    );
  }

  getCartCoordinates(centerIndex: number): ICoordinate[] {
    const center = this.track[centerIndex];
    if (!center) return [];

    const K = this.payloadCartSize;
    const startOffset = -Math.floor((K - 1) / 2);
    const endOffset = Math.floor(K / 2);

    const coords: ICoordinate[] = [];
    for (let dy = startOffset; dy <= endOffset; dy++) {
      for (let dx = startOffset; dx <= endOffset; dx++) {
        const coord = { x: center.x + dx, y: center.y + dy };
        if (this.grid.isValid(coord)) {
          coords.push(coord);
        }
      }
    }
    return coords;
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
      this.checkEliminations();
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

    // 1 tick = 0.5s, so payloadSpeed seconds translates to payloadSpeed * 2 ticks
    const speedTicks = Math.max(1, Math.round(this.payloadSpeed * 2));
    if (this.tick % speedTicks === 0) {
      this.evaluateCartPushing();
    }

    this.checkGameEnd();
  }

  private evaluateCartPushing(): void {
    let leftTeamCount = 0;
    let rightTeamCount = 0;

    const currentCartCoords = this.getCartCoordinates(this.cartIndex);
    for (const coord of currentCartCoords) {
      const cell = this.grid.get(coord);
      if (cell && cell.owner) {
        const ownerTeamId = cell.owner.team.teamId;
        if (ownerTeamId === this.leftTeamId) {
          leftTeamCount++;
        } else if (ownerTeamId === this.rightTeamId) {
          rightTeamCount++;
        }
      }
    }

    const leftPushes = leftTeamCount >= this.payloadRequiredOccupied;
    const rightPushes = rightTeamCount >= this.payloadRequiredOccupied;

    if (leftPushes && !rightPushes) {
      // Pushing right
      this.isContested = false;
      if (this.cartIndex < this.track.length - 1) {
        this.shiftCart(1);
      }
    } else if (rightPushes && !leftPushes) {
      // Pushing left
      this.isContested = false;
      if (this.cartIndex > 0) {
        this.shiftCart(-1);
      }
    } else if (leftTeamCount > 0 && rightTeamCount > 0) {
      // Both sides present but neither pushing/both pushing is contested
      this.isContested = true;
    } else {
      this.isContested = false;
    }
  }

  private shiftCart(direction: number): void {
    const newCartIndex = this.cartIndex + direction;
    const oldCenter = this.track[this.cartIndex];
    const newCenter = this.track[newCartIndex];
    const dx = newCenter.x - oldCenter.x;
    const dy = newCenter.y - oldCenter.y;

    const oldCartCoords = this.getCartCoordinates(this.cartIndex);

    // Sort to move the front row first, preventing back-row troops from merging prematurely
    oldCartCoords.sort((a, b) => {
      const scoreA = a.x * dx + a.y * dy;
      const scoreB = b.x * dx + b.y * dy;
      return scoreB - scoreA;
    });

    for (const coord of oldCartCoords) {
      const cell = this.grid.get(coord);
      if (cell && cell.owner && cell.troopCount && cell.troopCount > 1) {
        const targetCoord = { x: coord.x + dx, y: coord.y + dy };
        if (this.grid.isValid(targetCoord)) {
          this.combatResolver.execute(
            {
              playerId: cell.owner.playerId,
              type: ActionType.MOVE,
              from: coord,
              to: targetCoord,
            },
            this.grid,
            this.players,
          );
        }
      }
    }

    this.cartIndex = newCartIndex;
  }

  protected evaluateGameEnd(): IGameResult | null {
    if (this.cartIndex === 0) {
      // Right team pushed to Left base
      return {
        mode: this.mode,
        winnerTeamId: this.rightTeamId,
      };
    }

    if (this.cartIndex === this.track.length - 1) {
      // Left team pushed to Right base
      return {
        mode: this.mode,
        winnerTeamId: this.leftTeamId,
      };
    }

    if (this.tick >= this.maxTicks) {
      const centerIndex = (this.track.length - 1) / 2;
      if (this.cartIndex > centerIndex) {
        // Cart closer to right base, Left team wins
        return {
          mode: this.mode,
          winnerTeamId: this.leftTeamId,
        };
      }
      if (this.cartIndex < centerIndex) {
        // Cart closer to left base, Right team wins
        return {
          mode: this.mode,
          winnerTeamId: this.rightTeamId,
        };
      }
      // Exact center tie
      return {
        mode: this.mode,
        winnerTeamId: null,
      };
    }

    return null;
  }

  getScoreboard(): IPayloadScoreboard {
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
      cartProgress: this.payloadProgress,
      cartIndex: this.cartIndex,
      trackLength: this.track.length,
      totalTime: this.maxTicks / 2, // Represent in seconds
      speedSeconds: this.payloadSpeed,
      cartSize: this.payloadCartSize,
      minPushers: this.payloadRequiredOccupied,
      isContested: this.isContested,
      leftTeamId: this.leftTeamId ?? "",
      rightTeamId: this.rightTeamId ?? "",
    };
  }
}
