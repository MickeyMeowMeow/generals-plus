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
  IDemolitionGame,
  IDemolitionScoreboard,
} from "#/domain/game/interfaces";
import type { GridInput } from "#/domain/grid/grid-generator";
import { PlayerStatus } from "#/domain/player/player-status";
import { TeamType } from "#/domain/team/team-type";
import { ItemType } from "#/domain/item/item-type";
import { GameItem } from "#/domain/item/item";
import { SeededRandom } from "#/math/random";
import type { IPlayer } from "#/domain/player/interfaces";

export interface DemolitionGameOptions {
  plantDurationTicks?: number;
  defuseDurationTicks?: number;
  detonateDurationTicks?: number;
  bombSiteCount?: number;
  finishTick?: number;          // max ticks
  seed?: number;
}

export class DemolitionGame extends BaseGame implements IDemolitionGame {
  readonly mode = GameMode.DEMOLITION;
  private readonly combatResolver = new StandardCombatResolver();

  readonly plantDuration: number;
  readonly defuseDuration: number;
  readonly detonateDuration: number;
  readonly bombSiteCount: number;
  readonly maxTicks: number;
  readonly seed: number;

  plantedAtSite: string | null = null;
  detonationTick: number | null = null;
  plantProgressTicks: number = 0;
  defuseProgressTicks: number = 0;
  defuserId: string | null = null;
  isPlanted: boolean = false;
  isDefused: boolean = false;

  private readonly plantDurationTicks: number;
  private readonly defuseDurationTicks: number;
  private readonly detonateDurationTicks: number;

  constructor(input: GridInput, options?: DemolitionGameOptions) {
    super(input);
    this.bombSiteCount = options?.bombSiteCount ?? 2;
    this.maxTicks = options?.finishTick ?? 360;
    this.seed = options?.seed ?? 20260428;

    this.plantDurationTicks = options?.plantDurationTicks ?? 6;
    this.defuseDurationTicks = options?.defuseDurationTicks ?? 10;
    this.detonateDurationTicks = options?.detonateDurationTicks ?? 90;

    // Derived properties in seconds for backwards compatibility with scoreboard / UI representation
    this.plantDuration = Math.round((this.plantDurationTicks * 500) / 1000);
    this.defuseDuration = Math.round((this.defuseDurationTicks * 500) / 1000);
    this.detonateDuration = Math.round((this.detonateDurationTicks * 500) / 1000);

    // Configure combat resolver to block defenders from carrying, and prevent moving the bomb if already planted!
    this.combatResolver.canMoveItem = (item, player: IPlayer) => {
      if (item.type === ItemType.BOMB) {
        if (player.team.type === TeamType.DEFENDER) {
          return false;
        }
        if (this.isPlanted) {
          return false;
        }
      }
      return true;
    };
  }

  startGame(): void {
    super.startGame();
    this.assignStartPositions(Terrain.GENERAL);

    const rng = new SeededRandom(this.seed);

    // 1. Assign bomb sites if not already generated on the map
    let hasSites = false;
    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.BOMB_SITE) {
        hasSites = true;
      }
    });

    if (!hasSites) {
      const candidateCells: ICell[] = [];
      this.grid.forEach((cell) => {
        if (cell.terrain === Terrain.PLAIN && !cell.owner) {
          let safe = true;
          this.grid.forEachTerrain(Terrain.GENERAL, (gCell) => {
            if (this.grid.getDistance(cell.coordinate, gCell.coordinate) < 3) {
              safe = false;
            }
          });
          if (safe) {
            candidateCells.push(cell);
          }
        }
      });

      rng.shuffle(candidateCells);
      const count = Math.min(this.bombSiteCount, candidateCells.length);
      for (let i = 0; i < count; i++) {
        candidateCells[i].terrain = Terrain.BOMB_SITE;
        candidateCells[i].siteIndex = i;
      }
    }

    // 2. Instantiate and assign C4 bomb
    const attackers = Array.from(this.players.values()).filter(
      (p) => p.team.type === TeamType.ATTACKER,
    );
    if (attackers.length > 0) {
      const carrier = attackers[rng.nextInt(attackers.length)];
      let generalCell: ICell | null = null;
      this.grid.forEach((cell) => {
        if (
          cell.terrain === Terrain.GENERAL &&
          cell.owner?.playerId === carrier.playerId
        ) {
          generalCell = cell;
        }
      });

      if (generalCell) {
        const bomb = new GameItem(ItemType.BOMB, "bomb_1", (generalCell as ICell).coordinate);
        this.items.push(bomb);
        (generalCell as ICell).items.push(bomb);
      }
    }

    // 3. Register default troop growth effects
    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "demolition-general-troop-gen",
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
        id: "demolition-city-troop-gen",
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
        id: "demolition-plain-troop-gen",
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

    const bomb = this.items.find((item) => item.type === ItemType.BOMB);
    if (bomb) {
      const bombCell = this.grid.get(bomb.coordinate);
      if (bombCell) {
        if (!this.isPlanted && !this.isDefused) {
          // Evaluating planting
          const isAtSite = bombCell.terrain === Terrain.BOMB_SITE;
          const isOwnedByAttacker =
            bombCell.owner &&
            this.players.get(bombCell.owner.playerId)?.team.type ===
              TeamType.ATTACKER;
          const hasTroops = (bombCell.troopCount ?? 0) >= 1;

          if (isAtSite && isOwnedByAttacker && hasTroops) {
            this.plantProgressTicks++;
            if (this.plantProgressTicks >= this.plantDurationTicks) {
              this.isPlanted = true;
              this.plantedAtSite = String.fromCharCode(
                65 + (bombCell.siteIndex ?? 0),
              );
              this.detonationTick = this.tick + this.detonateDurationTicks;
              this.plantProgressTicks = 0;
            }
          } else {
            this.plantProgressTicks = 0;
          }
        } else if (this.isPlanted && !this.isDefused) {
          // Evaluating defusing
          const isOwnedByDefender =
            bombCell.owner &&
            this.players.get(bombCell.owner.playerId)?.team.type ===
              TeamType.DEFENDER;
          const hasTroops = (bombCell.troopCount ?? 0) >= 1;

          if (isOwnedByDefender && hasTroops) {
            this.defuserId = bombCell.owner?.playerId ?? null;
            this.defuseProgressTicks++;
            if (this.defuseProgressTicks >= this.defuseDurationTicks) {
              this.isDefused = true;
              this.defuseProgressTicks = 0;
              this.defuserId = null;
            }
          } else {
            this.defuseProgressTicks = 0;
            this.defuserId = null;
          }
        }
      }
    }

    this.checkGameEnd();
  }

  protected evaluateGameEnd(): IGameResult | null {
    const attackers = Array.from(this.players.values()).filter(
      (p) => p.team.type === TeamType.ATTACKER,
    );
    const defenders = Array.from(this.players.values()).filter(
      (p) => p.team.type === TeamType.DEFENDER,
    );

    const activeAttackers = attackers.filter(
      (p) => p.status === PlayerStatus.ACTIVE,
    );
    const activeDefenders = defenders.filter(
      (p) => p.status === PlayerStatus.ACTIVE,
    );

    const attackerTeam = attackers[0]?.team;
    const defenderTeam = defenders[0]?.team;

    // Attackers win conditions
    const hasDetonated =
      this.isPlanted && this.tick >= (this.detonationTick ?? 0);
    const allDefendersEliminated =
      defenders.length > 0 && activeDefenders.length === 0;

    if (hasDetonated || allDefendersEliminated) {
      return {
        mode: this.mode,
        winnerTeamId: attackerTeam?.teamId ?? null,
      };
    }

    // Defenders win conditions
    const hasDefused = this.isDefused;
    const timeLimitReached = this.tick >= this.maxTicks;
    const allAttackersEliminated =
      attackers.length > 0 && activeAttackers.length === 0;

    if (hasDefused || timeLimitReached || allAttackersEliminated) {
      return {
        mode: this.mode,
        winnerTeamId: defenderTeam?.teamId ?? null,
      };
    }

    return null;
  }

  getScoreboard(): IDemolitionScoreboard {
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
      bombSiteCount: this.bombSiteCount,
      plantedAtSite: this.plantedAtSite,
      detonationTick: this.detonationTick,
      plantProgressTicks: this.plantProgressTicks,
      defuseProgressTicks: this.defuseProgressTicks,
      defuserId: this.defuserId,
      isPlanted: this.isPlanted,
      isDefused: this.isDefused,
      plantDuration: this.plantDuration,
      defuseDuration: this.defuseDuration,
      detonateDuration: this.detonateDuration,
    };
  }
}
