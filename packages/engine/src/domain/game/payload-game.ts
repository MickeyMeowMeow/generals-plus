import { ActionType } from "#/domain/action/action-type";
import type { Action } from "#/domain/action/interfaces";
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
import type { ICoordinate } from "#/math/coordinate";

export interface PayloadGameOptions {
  finishTick?: number;
  payloadSpeedTicks?: number;
  payloadCartSize?: number;
  payloadRequiredOccupied?: number;
}

export class PayloadGame extends BaseGame implements IPayloadGame {
  readonly mode = GameMode.PAYLOAD;
  private readonly combatResolver = new StandardCombatResolver();

  readonly payloadSpeedTicks: number;
  readonly payloadCartSize: number;
  readonly payloadRequiredOccupied: number;
  readonly maxTicks: number;

  track: ICoordinate[] = [];
  cartIndex: number = 0;
  leftTeamId: string | null = null;
  rightTeamId: string | null = null;
  isContested: boolean = false;
  pushingTeamId: string | null = null;

  get payloadProgress(): number {
    if (this.track.length <= 1) return 0.5;
    return this.cartIndex / (this.track.length - 1);
  }

  constructor(input: GridInput, options?: PayloadGameOptions) {
    super(input);
    this.maxTicks = options?.finishTick ?? 600;
    this.payloadSpeedTicks = options?.payloadSpeedTicks ?? 4;
    this.payloadCartSize = options?.payloadCartSize ?? 3;
    this.payloadRequiredOccupied = options?.payloadRequiredOccupied ?? 6;
  }

  startGame(): void {
    super.startGame();
    this.assignStartPositions(Terrain.GENERAL);

    // Get track from grid
    this.track = this.grid.track;
    if (this.track.length === 0) {
      const bounds = this.grid.bounds;
      const isHex = "leftSlant" in bounds;
      const height = isHex ? bounds.leftSlant : bounds.height;
      const cy = Math.floor(height / 2);
      const track: ICoordinate[] = [];
      const bendOffset = Math.floor(height / 5);
      const leftY = Math.max(1, cy - bendOffset);
      const rightY = Math.min(height - 2, cy + bendOffset);

      let startX: number, endX: number;
      if (!isHex) {
        startX = Math.min(3, Math.floor(bounds.width / 2));
        endX = Math.max(startX, bounds.width - 1 - startX);
      } else {
        const hL = bounds.left,
          hR = bounds.right,
          hRS = bounds.rightSlant;
        const minXAt = (y: number) => Math.max(-hL + 1, -y);
        const maxXAt = (y: number) => Math.min(hR - 1, hRS - y - 1);
        startX = Math.max(minXAt(leftY) + 1, minXAt(Math.max(0, leftY - 2)));
        endX = Math.min(
          maxXAt(rightY) - 1,
          maxXAt(Math.min(height - 1, rightY + 2)),
        );
      }

      for (let y = leftY; y < cy; y++) track.push({ x: startX, y });
      for (let x = startX; x <= endX; x++) track.push({ x, y: cy });
      for (let y = cy + 1; y <= rightY; y++) track.push({ x: endX, y });
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

    // 1. Evaluate push conditions immediately every single tick so UI shows "Moving by Team X" or "Stopped" in real-time.
    this.evaluateCartPushingStatus();

    // 2. Controlled cart movement shifting still only executes at the speed frequency tick interval.
    const speedTicks = Math.max(1, Math.round(this.payloadSpeedTicks));
    if (this.tick % speedTicks === 0) {
      this.executeCartMovement();
    }

    this.checkGameEnd();
  }

  private evaluateCartPushingStatus(): void {
    let leftTeamCount = 0;
    let rightTeamCount = 0;

    const currentCartCoords = this.getCartCoordinates(this.cartIndex);
    for (const coord of currentCartCoords) {
      const cell = this.grid.get(coord);
      if (cell?.owner) {
        const ownerTeamId = (cell.owner as IPlayer).team.teamId;
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
      this.pushingTeamId = this.leftTeamId;
    } else if (rightPushes && !leftPushes) {
      // Pushing left
      this.isContested = false;
      this.pushingTeamId = this.rightTeamId;
    } else if (leftTeamCount > 0 && rightTeamCount > 0) {
      // Both sides present but neither pushing/both pushing is contested
      this.isContested = true;
      this.pushingTeamId = null;
    } else {
      this.isContested = false;
      this.pushingTeamId = null;
    }
  }

  private executeCartMovement(): void {
    if (this.pushingTeamId === this.leftTeamId) {
      if (this.cartIndex < this.track.length - 1) {
        this.shiftCart(1);
      }
    } else if (this.pushingTeamId === this.rightTeamId) {
      if (this.cartIndex > 0) {
        this.shiftCart(-1);
      }
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
      if (cell?.owner && cell.troopCount && cell.troopCount > 1) {
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
      totalTimeTicks: this.maxTicks,
      speedTicks: this.payloadSpeedTicks,
      cartSize: this.payloadCartSize,
      minPushers: this.payloadRequiredOccupied,
      isContested: this.isContested,
      pushingTeamId: this.pushingTeamId,
      leftTeamId: this.leftTeamId ?? "",
      rightTeamId: this.rightTeamId ?? "",
    };
  }
}
